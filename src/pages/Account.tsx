import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { useCurrency } from '../context/CurrencyContext';
import { db } from '../firebase/config';
import { doc, getDoc, setDoc, collection, addDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import SidebarLayout from '../components/SidebarLayout';
import SmartDateInput from '../components/SmartDateInput';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { useToast } from '../context/ToastContext';
import { SUPPORTED_COUNTRIES } from '../constants/countries';
import { useAdmin } from '../hooks/useAdmin';
import { useTier } from '../hooks/useTier';
import { usePartner } from '../context/PartnerContext';
import { TierType, TIER_INFO, getCurrencySymbol, isAnnualOnly } from '../constants/tiers';
import { usePricing } from '../hooks/usePricing';
import { usePageTitle } from '../hooks/usePageTitle';

type Tab = 'profile' | 'subscription' | 'billing';

interface UserProfile {
  displayName: string;
  fullName: string;
  email: string;
  phone: string;
  nationality: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  dateOfBirth: string;
  occupation: string;
}

export default function Account() {
  const { user } = useAuth();
  usePageTitle('Account');
  const { t, locale, isGerman } = useLocale();
  const { currency } = useCurrency();
  const { showToast } = useToast();
  const { isCouples } = useTier();
  const { partnerName, setPartnerName, partnerDob, setPartnerDob, familyLink, isLinked } = usePartner();
  const [tab, setTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    displayName: '', fullName: '', email: user?.email || '', phone: '', nationality: '', address: '', city: '',
    country: '', postalCode: '', dateOfBirth: '', occupation: '',
  });

  // Partner profile (Family Premium)
  const [partnerProfile, setPartnerProfile] = useState<{
    nationality: string; address: string; city: string; country: string; postalCode: string; occupation: string; taxResidency: string;
  }>({ nationality: '', address: '', city: '', country: '', postalCode: '', occupation: '', taxResidency: '' });

  const updatePartnerField = (field: string, value: string) => {
    setPartnerProfile(prev => ({ ...prev, [field]: value }));
  };

  // Family invite link
  const [inviteLink, setInviteLink] = useState('');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [partnerEmail, setPartnerEmail] = useState('');
  const [inviteSent, setInviteSent] = useState(false);

  const generateAndSendInvite = async () => {
    if (!user || !partnerEmail.trim() || !partnerEmail.includes('@')) {
      showToast('Please enter a valid partner email', 'error'); return;
    }
    if (partnerEmail.trim() === user.email) {
      showToast("You can't invite yourself", 'error'); return;
    }
    setGeneratingInvite(true);
    try {
      const code = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const link = `${window.location.origin}/family-invite?code=${code}`;
      await setDoc(doc(db, 'system', 'family_invites', 'codes', code), {
        primaryUid: user.uid,
        primaryEmail: user.email,
        primaryName: user.displayName || partnerName || user.email?.split('@')[0] || 'Partner',
        partnerEmail: partnerEmail.trim(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        used: false,
        inviteLink: link,
      });
      setInviteLink(link);

      // Send invite email via Cloud Function
      try {
        const fns = getFunctions();
        const sendInvite = httpsCallable(fns, 'sendFamilyInviteEmail');
        await sendInvite({ partnerEmail: partnerEmail.trim(), inviteLink: link, primaryName: user.displayName || partnerName || 'Your partner' });
        setInviteSent(true);
        showToast(`Invite sent to ${partnerEmail.trim()}`, 'success');
      } catch (emailErr) {
        console.warn('[Account] Email send failed, link still generated:', emailErr);
        showToast('Link generated! Email delivery pending — you can share the link manually.', 'success');
      }
    } catch (err) {
      console.error('[Account] Invite generation error:', err);
      showToast('Failed to generate invite link', 'error');
    } finally { setGeneratingInvite(false); }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  useEffect(() => { if (user) loadProfile(); }, [user]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const snap = await getDoc(doc(db, 'users', user!.uid));
      if (snap.exists()) {
        const d = snap.data();
        setProfile({
          displayName: d.displayName || '', fullName: d.fullName || '', email: user!.email || '', phone: d.phone || '',
          nationality: d.nationality || '',
          address: d.address || '', city: d.city || '', country: d.country || '',
          postalCode: d.postalCode || '', dateOfBirth: d.dateOfBirth || '',
          occupation: d.occupation || '',
        });
        // Load partner profile — default address to user's address
        if (d.partnerProfile) {
          setPartnerProfile(d.partnerProfile);
        } else {
          setPartnerProfile({
            nationality: '', address: d.address || '', city: d.city || '',
            country: d.country || '', postalCode: d.postalCode || '',
            occupation: '', taxResidency: d.country || '',
          });
        }
      }
    } catch (err) { console.error('Error loading profile:', err); }
    finally { setLoading(false); }
  };

  const updateField = (field: string, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const saveData: any = { ...profile, updatedAt: new Date() };
      if (isCouples) {
        saveData.partnerProfile = partnerProfile;
      }
      await setDoc(doc(db, 'users', user!.uid), saveData, { merge: true });
      showToast(t('settings.saved') || 'Saved!', 'success');
    } catch (err: any) {
      console.error('[Account] Profile save error:', err?.code, err?.message, err);
      showToast(`${t('settings.saveFailed') || 'Failed to save'}: ${err?.code || ''}`, 'error');
    } finally { setSaving(false); }
  };

  const isGoogle = user?.providerData.some(p => p.providerId === 'google.com');

  if (loading) {
    return (
      <SidebarLayout>
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-6" />
          {[1,2,3].map(i => <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse mb-4" />)}
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 animate-fadeIn">
          <h1 className="text-2xl lg:text-3xl font-bold text-secondary font-display">Account</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your personal information, subscription, and billing.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-6">
          {([
            { id: 'profile' as Tab, label: 'Profile & Address', icon: '👤' },
            { id: 'subscription' as Tab, label: 'Subscription', icon: '⭐' },
            { id: 'billing' as Tab, label: 'Billing & Payments', icon: '💳' },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === t.id ? 'bg-secondary text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* ═══ PROFILE TAB ═══════════════════════════════════ */}
        {tab === 'profile' && (
          <div className="space-y-6">
            {/* Account info bar */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                {(profile.displayName || profile.fullName || profile.email || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold text-secondary truncate">{profile.displayName || profile.fullName || 'Set your name'}</div>
                <div className="text-sm text-slate-500 truncate">{profile.email}</div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg">
                <span className="text-xs">{isGoogle ? '🔵' : '📧'}</span>
                <span className="text-xs text-slate-600 font-medium">{isGoogle ? 'Google' : 'Email'}</span>
              </div>
            </div>

            {/* Personal Information — Side by side for Family Premium */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 lg:p-8">
              <h2 className="text-lg font-bold text-secondary mb-5 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                Personal Information
              </h2>

              <div className={isCouples ? 'grid lg:grid-cols-2 gap-6' : ''}>
                {/* ── Partner 1 (You) ── */}
                <div className={isCouples ? 'bg-teal-50/30 border border-teal-200/30 rounded-xl p-5' : ''}>
                  {isCouples && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">You</span>
                    </div>
                  )}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Display Name</label>
                      <input type="text" value={profile.displayName} onChange={e => updateField('displayName', e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" placeholder="Bobby" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name (Legal)</label>
                      <input type="text" value={profile.fullName} onChange={e => updateField('fullName', e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" placeholder="John Doe" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                      <input type="email" value={profile.email} disabled
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-400 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                      <input type="tel" value={profile.phone} onChange={e => updateField('phone', e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" />
                    </div>
                    <div>
                      <SmartDateInput
                        label={<>Date of Birth <span className="text-amber-500">*</span></>}
                        value={profile.dateOfBirth}
                        onChange={v => updateField('dateOfBirth', v)}
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Nationality <span className="text-amber-500">*</span></label>
                      <select value={profile.nationality} onChange={e => updateField('nationality', e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all">
                        <option value="">Select nationality</option>
                        {SUPPORTED_COUNTRIES.map(c => (
                          <option key={c.code} value={c.name}>{c.flag} {isGerman ? c.nameDE : c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Occupation</label>
                      <input type="text" value={profile.occupation} onChange={e => updateField('occupation', e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" />
                    </div>
                  </div>
                </div>

                {/* ── Partner 2 ── */}
                {isCouples && (
                  <div className="bg-violet-50/30 border border-violet-200/30 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full bg-violet-500" />
                      <span className="text-xs font-bold text-violet-600 uppercase tracking-wider">{partnerName || 'Partner'}</span>
                      {isLinked && (
                        <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">✓ Linked</span>
                      )}
                    </div>

                    {isLinked ? (
                      /* ── Linked State ── */
                      <div>
                        <div className="p-3 bg-white rounded-xl border border-violet-100 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-secondary">Partner account linked</div>
                              <div className="text-[10px] text-slate-400">{familyLink?.partnerEmail} — has independent Premium access</div>
                            </div>
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Partner Name</label>
                            <input type="text" value={partnerName} onChange={e => setPartnerName(e.target.value)}
                              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary focus:border-violet-400/40 focus:ring-2 focus:ring-violet-400/10 transition-all" placeholder="Partner's name" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Partner Email</label>
                            <div className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50 text-slate-400 text-sm">
                              {familyLink?.partnerEmail || '—'}
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1.5">
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Personal details (DoB, nationality, occupation) are managed by your partner in their own account. Address is shared from your profile.
                        </p>
                      </div>
                    ) : (
                      /* ── Invite State ── */
                      <div>
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Partner Name <span className="text-amber-500">*</span></label>
                            <input type="text" value={partnerName} onChange={e => setPartnerName(e.target.value)}
                              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary focus:border-violet-400/40 focus:ring-2 focus:ring-violet-400/10 transition-all" placeholder="Partner's full name" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Partner Email <span className="text-amber-500">*</span></label>
                            <input type="email" value={partnerEmail} onChange={e => setPartnerEmail(e.target.value)}
                              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary focus:border-violet-400/40 focus:ring-2 focus:ring-violet-400/10 transition-all" placeholder="partner@email.com" />
                          </div>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-violet-100">
                          {inviteLink ? (
                            <div>
                              {inviteSent && (
                                <div className="flex items-center gap-2 mb-3 text-emerald-600">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                  <span className="text-xs font-semibold">Invite email sent to {partnerEmail}</span>
                                </div>
                              )}
                              <div className="text-[10px] text-slate-400 mb-2">Or share this link manually:</div>
                              <div className="flex gap-2">
                                <input type="text" value={inviteLink} readOnly className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-600 font-mono" />
                                <button onClick={copyInviteLink}
                                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${inviteCopied ? 'bg-emerald-100 text-emerald-700' : 'bg-primary text-white hover:bg-primary/90'}`}>
                                  {inviteCopied ? '✓ Copied' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-xs font-semibold text-secondary mb-1.5">Invite your partner</div>
                              <p className="text-[10px] text-slate-400 mb-3">An activation email will be sent from myfynzo.com. Your partner creates their own account with full Premium access. Their financial data becomes visible to you via the Family toggle.</p>
                              <button onClick={generateAndSendInvite} disabled={generatingInvite || !partnerName.trim() || !partnerEmail.trim()}
                                className={`px-5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                                  generatingInvite || !partnerName.trim() || !partnerEmail.trim()
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-violet-500 to-primary text-white hover:shadow-lg shadow-violet-500/20'
                                }`}>
                                {generatingInvite ? 'Sending invite...' : '✉️ Send Invite to Partner'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Shared Address */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 lg:p-8">
              <h2 className="text-lg font-bold text-secondary mb-1 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                Registered Address
                {isCouples && <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md ml-2">Shared</span>}
              </h2>
              <p className="text-xs text-slate-400 mb-5">
                {isCouples ? 'Shared household address for both partners.' : 'Your legal residential address.'} Country is set based on your registration.
              </p>
              <div className="grid md:grid-cols-2 gap-5">
                {/* Country — locked */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Country of Residence</label>
                  <div className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50 text-secondary flex items-center justify-between">
                    <span>{SUPPORTED_COUNTRIES.find(c => c.name === profile.country)?.flag || '🌍'} {profile.country || 'Not set'}</span>
                    <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                </div>

                {/* Nationality — already shown above in Personal Info, so skip here for non-couples */}
                {!isCouples && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Nationality <span className="text-amber-500">*</span></label>
                    <select value={profile.nationality} onChange={e => updateField('nationality', e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all">
                      <option value="">Select nationality</option>
                      {SUPPORTED_COUNTRIES.map(c => (
                        <option key={c.code} value={c.name}>{c.flag} {isGerman ? c.nameDE : c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <AddressAutocomplete
                  street={profile.address}
                  city={profile.city}
                  postalCode={profile.postalCode}
                  country={profile.country}
                  onStreetChange={v => updateField('address', v)}
                  onCityChange={v => updateField('city', v)}
                  onPostalCodeChange={v => updateField('postalCode', v)}
                />
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end gap-3">
              <button onClick={loadProfile} className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors">
                Reset
              </button>
              <button onClick={handleSave} disabled={saving}
                className={`px-8 py-3 rounded-xl font-semibold transition-all text-white flex items-center gap-2 ${
                  saving ? 'bg-slate-300 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20'
                }`}>
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                ) : (
                  <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Save Changes</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ═══ SUBSCRIPTION TAB ══════════════════════════════ */}
        {tab === 'subscription' && (
          <SubscriptionTab user={user!} currency={currency} showToast={showToast} />
        )}

        {/* ═══ BILLING TAB ═══════════════════════════════════ */}
        {tab === 'billing' && (
          <div className="space-y-6">
            {/* Payment methods */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 lg:p-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-secondary">Payment Methods</h2>
                <button className="px-4 py-2 text-sm font-semibold text-primary border border-primary/20 rounded-xl hover:bg-primary/5 transition-colors">
                  + Add Payment Method
                </button>
              </div>

              {/* Empty state */}
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-secondary mb-1">No payment method on file</p>
                <p className="text-xs text-slate-500">Add a payment method to upgrade to Premium.</p>
              </div>

              {/* Supported methods */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="text-xs text-slate-400 mb-2 font-medium">Accepted payment methods</div>
                <div className="flex items-center gap-3">
                  {[
                    { name: 'Visa', bg: 'bg-blue-600', text: 'VISA' },
                    { name: 'Mastercard', bg: 'bg-red-500', text: 'MC' },
                    { name: 'SEPA', bg: 'bg-emerald-600', text: 'SEPA' },
                    { name: 'PayPal', bg: 'bg-blue-500', text: 'PP' },
                  ].map((m, i) => (
                    <div key={i} className={`${m.bg} text-white text-[10px] font-bold px-2.5 py-1 rounded-md`}>{m.text}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Billing history */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 lg:p-8">
              <h2 className="text-lg font-bold text-secondary mb-5">Billing History</h2>
              <div className="text-center py-6">
                <p className="text-sm text-slate-500">No billing history yet.</p>
                <p className="text-xs text-slate-400 mt-1">Invoices will appear here once you upgrade to Premium.</p>
              </div>
            </div>

            {/* Billing info */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
              <h2 className="text-lg font-bold text-secondary mb-4">Billing Address</h2>
              {profile.address || profile.city ? (
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-secondary font-semibold">{profile.fullName}</p>
                  {profile.address && <p className="text-sm text-slate-600">{profile.address}</p>}
                  <p className="text-sm text-slate-600">
                    {[profile.postalCode, profile.city].filter(Boolean).join(' ')}
                  </p>
                  {profile.country && <p className="text-sm text-slate-600">{profile.country}</p>}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl text-center">
                  <p className="text-sm text-slate-500">No billing address set.</p>
                  <button onClick={() => setTab('profile')} className="text-xs text-primary font-semibold hover:underline mt-1">
                    Add address in Profile →
                  </button>
                </div>
              )}
            </div>

            {/* Security note */}
            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <div>
                <div className="text-sm font-semibold text-emerald-800">Secure payments</div>
                <div className="text-xs text-emerald-600">Payments are processed by Stripe. myfynzo never stores your card details.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}

// ─── Subscription Tab Component ──────────────────────────────
function SubscriptionTab({ user, currency, showToast }: { user: any; currency: string; showToast: (msg: string, type: 'success' | 'error') => void }) {
  const { isAdmin } = useAdmin();
  const { tier } = useTier();
  const { getPrice, getAnnualSavings } = usePricing();
  const [selectedTier, setSelectedTier] = useState<TierType>(tier);
  const [savingTier, setSavingTier] = useState(false);
  const [joinedWaitlist, setJoinedWaitlist] = useState<string | null>(null);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);

  useEffect(() => { setSelectedTier(tier); }, [tier]);

  // Check if already on waitlist
  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      const data = snap.data();
      if (data?.premiumWaitlist) setJoinedWaitlist(data.premiumWaitlist);
    }).catch(() => {});
  }, [user.uid]);

  const sym = getCurrencySymbol(currency);

  const handleJoinWaitlist = async (planId: string) => {
    setJoiningWaitlist(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        premiumWaitlist: planId,
        premiumWaitlistAt: new Date(),
        updatedAt: new Date(),
      }, { merge: true });
      setJoinedWaitlist(planId);
      showToast(`You're on the ${planId === 'couples' ? 'Family Premium' : 'Premium'} waitlist!`, 'success');
    } catch {
      showToast('Could not join waitlist. Try again.', 'error');
    } finally { setJoiningWaitlist(false); }
  };

  const handleSaveTier = async () => {
    setSavingTier(true);
    try {
      await setDoc(doc(db, 'users', user.uid), { tier: selectedTier, updatedAt: new Date() }, { merge: true });
      showToast(`Plan updated to ${selectedTier === 'couples' ? 'Family Premium' : selectedTier}`, 'success');
    } catch (err: any) {
      console.error('[Account] Tier save error:', err?.code, err?.message, err);
      showToast(`Failed to update plan: ${err?.code || err?.message || 'Unknown error'}`, 'error');
    } finally { setSavingTier(false); }
  };

  const plans: { id: TierType; border: string; bg: string; badge?: { text: string; color: string }; accent: string; btnClass: string }[] = [
    { id: 'free', border: 'border-slate-200', bg: 'bg-white', accent: 'text-primary', btnClass: 'border border-slate-200 text-slate-700 hover:bg-slate-50' },
    { id: 'premium', border: 'border-primary/40', bg: 'bg-primary/[0.02]', badge: { text: 'Popular', color: 'bg-primary text-white' }, accent: 'text-primary', btnClass: 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20' },
    { id: 'couples', border: 'border-violet-300/50', bg: 'bg-gradient-to-br from-violet-50/50 to-amber-50/50', badge: { text: 'Family', color: 'bg-violet-500 text-white' }, accent: 'text-violet-600', btnClass: 'bg-gradient-to-r from-violet-500 to-primary text-white hover:opacity-90 shadow-lg shadow-violet-500/20' },
  ];

  return (
    <div className="space-y-6">
      {/* Admin override banner */}
      {isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg">🔧</span>
            <div>
              <div className="text-sm font-bold text-amber-800">Admin Mode</div>
              <div className="text-xs text-amber-600">You can select and save any plan for testing.</div>
            </div>
          </div>
          {selectedTier !== tier && (
            <button onClick={handleSaveTier} disabled={savingTier}
              className={`px-5 py-2 rounded-xl font-semibold text-sm transition-all ${savingTier ? 'bg-slate-200 text-slate-400' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
              {savingTier ? 'Saving...' : `Save as "${selectedTier}"`}
            </button>
          )}
        </div>
      )}

      {/* Plan cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {plans.map(plan => {
          const info = TIER_INFO[plan.id];
          const isCurrent = tier === plan.id;
          const isSelected = selectedTier === plan.id;
          const price = plan.id === 'free' ? 0 : getPrice(currency, plan.id as 'premium' | 'couples', 'monthly');
          const annual = plan.id === 'free' ? 0 : getPrice(currency, plan.id as 'premium' | 'couples', 'annual');
          const savings = plan.id === 'free' ? 0 : getAnnualSavings(currency, plan.id as 'premium' | 'couples');
          const annualOnly = isAnnualOnly(currency);

          return (
            <div key={plan.id}
              onClick={() => isAdmin ? setSelectedTier(plan.id) : undefined}
              className={`relative rounded-2xl p-5 border-2 transition-all ${
                isSelected && isAdmin ? 'ring-2 ring-offset-2 ring-primary' : ''
              } ${isCurrent ? `border-primary ${plan.bg}` : `${plan.border} ${plan.bg}`} ${isAdmin ? 'cursor-pointer hover:shadow-lg' : ''}`}>
              
              {/* Badges */}
              {isCurrent && (
                <div className="absolute -top-2.5 left-4 px-2.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full uppercase">Current</div>
              )}
              {plan.badge && !isCurrent && (
                <div className={`absolute -top-2.5 right-4 px-2.5 py-0.5 ${plan.badge.color} text-[10px] font-bold rounded-full`}>{plan.badge.text}</div>
              )}

              <div className="mt-1">
                <div className="text-lg font-bold text-secondary mb-0.5">{info.name}</div>
                <div className="text-xs text-slate-500 mb-3">{info.tagline}</div>
                
                <div className="flex items-baseline gap-0.5 mb-0.5">
                  <span className="text-2xl font-bold text-secondary">{sym}{annualOnly && plan.id !== 'free' ? annual : (price === 0 ? '0' : price.toFixed(2))}</span>
                  <span className="text-sm text-slate-400">{annualOnly && plan.id !== 'free' ? '/year' : '/month'}</span>
                </div>
                {plan.id !== 'free' && !annualOnly && (
                  <div className="text-xs text-slate-500 mb-4">or {sym}{annual}/year — save {savings}%</div>
                )}
                {plan.id !== 'free' && annualOnly && (
                  <div className="text-xs text-slate-500 mb-4">That's just {sym}{price.toFixed(2)}/mo · Annual billing · No refunds</div>
                )}
                {plan.id === 'free' && <div className="text-xs text-slate-500 mb-4">Free forever</div>}

                {/* Family Premium visual for couples */}
                {plan.id === 'couples' && (
                  <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-2.5 mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-4 h-4 rounded-full bg-primary/40 flex items-center justify-center text-[7px] text-white font-bold">1</div>
                      <div className="w-4 h-4 rounded-full bg-violet-400/40 flex items-center justify-center text-[7px] text-white font-bold">2</div>
                      <span className="text-[8px] text-white/50">2 users, 1 subscription</span>
                    </div>
                    <div className="text-white text-[9px] font-semibold">Family Premium</div>
                  </div>
                )}

                <ul className="space-y-2 mb-5">
                  {info.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                      <svg className={`w-3.5 h-3.5 flex-shrink-0 ${plan.accent}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                {!isAdmin && !isCurrent && plan.id !== 'free' && (
                  joinedWaitlist === plan.id ? (
                    <div className="w-full py-3 rounded-xl text-sm font-semibold bg-green-50 border border-green-200 text-green-700 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        You're on the waitlist!
                      </div>
                      <p className="text-[10px] text-green-600 mt-0.5">We'll notify you when {info.name} is available.</p>
                    </div>
                  ) : (
                    <button onClick={() => handleJoinWaitlist(plan.id)} disabled={joiningWaitlist}
                      className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${plan.btnClass}`}>
                      {joiningWaitlist ? 'Joining...' : `Join ${info.name} Waitlist`}
                    </button>
                  )
                )}
                {!isAdmin && !isCurrent && plan.id === 'free' && (
                  <div className="w-full py-2.5 text-center text-xs text-slate-400 rounded-xl">Contact support to downgrade</div>
                )}
                {!isAdmin && isCurrent && (
                  <div className="w-full py-2.5 text-center bg-slate-100 text-slate-400 rounded-xl text-sm font-semibold">Current Plan</div>
                )}
                {isAdmin && (
                  <div className={`w-full py-2.5 text-center rounded-xl text-sm font-semibold ${isSelected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {isSelected ? (isCurrent ? '✓ Current' : '● Selected') : 'Click to select'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Usage */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
        <h2 className="text-lg font-bold text-secondary mb-4">Plan Usage</h2>
        <div className="space-y-3">
          {[
            { label: 'Investments', used: '—', limit: tier === 'free' ? '3' : '∞', pct: 0 },
            { label: 'Wealth Projector', used: '—', limit: tier === 'free' ? 'Locked' : '50 yr', pct: tier === 'free' ? 0 : 100 },
            { label: 'Tax calculators', used: tier === 'free' ? '0' : '2', limit: '2', pct: tier === 'free' ? 0 : 100 },
            { label: 'Users', used: '1', limit: tier === 'couples' ? '2' : '1', pct: tier === 'couples' ? 50 : 100 },
          ].map((item, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded-xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-secondary">{item.label}</span>
                <span className="text-xs text-slate-500">{item.used} / {item.limit}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${item.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
