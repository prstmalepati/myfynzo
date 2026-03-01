import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SidebarLayout from '../components/SidebarLayout';
import { BLOG_POSTS } from '../data/blogData';
import { usePageTitle } from '../hooks/usePageTitle';

function BlogContent({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <>
      {/* Header */}
      <section className={`${isLoggedIn ? 'pt-0 pb-8' : 'pt-16 pb-12'} px-6 ${isLoggedIn ? '' : 'bg-gradient-to-b from-slate-50 to-white'}`}>
        <div className="max-w-5xl mx-auto text-center">
          {!isLoggedIn && <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-3">myfynzo Blog</p>}
          <h1 className={`${isLoggedIn ? 'text-2xl lg:text-3xl' : 'text-3xl lg:text-4xl'} font-bold text-secondary font-display tracking-tight mb-4`}>
            Insights for smarter<br /><span className="text-primary">financial decisions</span>
          </h1>
          <p className="text-slate-500 max-w-lg mx-auto">Practical guides on building wealth, achieving financial independence, and mastering the psychology of money.</p>
        </div>
      </section>

      {/* Articles */}
      <section className={`${isLoggedIn ? 'pb-8' : 'py-12'} px-6`}>
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BLOG_POSTS.map(post => (
              <Link key={post.slug} to={`/blog/${post.slug}`}
                className="group bg-white rounded-2xl border border-slate-200 hover:border-transparent hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                <div className={`h-40 bg-gradient-to-br ${post.coverGradient} flex items-center justify-center relative overflow-hidden`}>
                  <span className="text-6xl opacity-80 group-hover:scale-110 transition-transform duration-300">{post.coverEmoji}</span>
                  <div className="absolute top-3 left-3">
                    <span className="text-[10px] font-bold text-white/80 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full">{post.category}</span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-secondary text-base mb-2 leading-snug group-hover:text-primary transition-colors">{post.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4 line-clamp-2">{post.subtitle}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <img src="/logo-transparent.png" alt="myfynzo" className="w-full h-full object-contain" />
                      </div>
                      <span className="text-[10px] text-slate-400">{post.author}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span>{post.readTime}</span>
                      <span>{new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {!isLoggedIn && (
        <section className="py-16 px-6 bg-gradient-to-br from-secondary to-surface-700 text-center">
          <h2 className="text-2xl font-bold text-white font-display mb-3">Ready to take control of your wealth?</h2>
          <p className="text-white/50 text-sm mb-6 max-w-md mx-auto">Start tracking your finances with AI-powered insights — free forever.</p>
          <Link to="/signup" className="inline-block px-7 py-3.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
            Create Your Free Account →
          </Link>
        </section>
      )}

      {!isLoggedIn && (
        <footer className="py-8 px-6 border-t border-slate-100 bg-white text-center">
          <p className="text-xs text-slate-400">© 2026 myfynzo · Your Wealth. Reimagined by AI.</p>
        </footer>
      )}
    </>
  );
}

export default function Blog() {
  const { user } = useAuth();
  usePageTitle('Blog');

  if (user) {
    return (
      <SidebarLayout>
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          <BlogContent isLoggedIn />
        </div>
      </SidebarLayout>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo-transparent.png" alt="myfynzo" className="w-12 h-12 object-contain" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-secondary tracking-tight font-display leading-none">myfynzo</span>
              <span className="text-[10px] font-medium text-primary tracking-[0.15em] mt-1">Your Wealth. Reimagined by AI.</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-sm text-slate-500 hover:text-secondary transition-colors font-medium">← Home</Link>
            <Link to="/signup" className="px-5 py-2 bg-secondary text-white text-sm font-semibold rounded-lg hover:bg-secondary/90 transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>
      <BlogContent isLoggedIn={false} />
    </div>
  );
}
