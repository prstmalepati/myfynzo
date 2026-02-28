import { useParams, Link, Navigate } from 'react-router-dom';
import { BLOG_POSTS } from '../data/blogData';

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = BLOG_POSTS.find(p => p.slug === slug);

  if (!post) return <Navigate to="/blog" replace />;

  // Simple markdown-to-JSX renderer
  const renderContent = (content: string) => {
    return content.split('\n\n').map((block, i) => {
      // Heading
      if (block.startsWith('**') && block.endsWith('**') && !block.slice(2, -2).includes('**')) {
        return <h2 key={i} className="text-xl font-bold text-secondary font-display mt-10 mb-4">{block.slice(2, -2)}</h2>;
      }

      // Process inline formatting
      const processInline = (text: string) => {
        const parts: (string | JSX.Element)[] = [];
        let remaining = text;
        let key = 0;
        
        while (remaining.length > 0) {
          const boldIdx = remaining.indexOf('**');
          if (boldIdx === -1) {
            parts.push(remaining);
            break;
          }
          if (boldIdx > 0) parts.push(remaining.slice(0, boldIdx));
          const endBold = remaining.indexOf('**', boldIdx + 2);
          if (endBold === -1) {
            parts.push(remaining);
            break;
          }
          parts.push(<strong key={key++} className="font-semibold text-secondary">{remaining.slice(boldIdx + 2, endBold)}</strong>);
          remaining = remaining.slice(endBold + 2);
        }
        return parts;
      };

      // Bullet list
      if (block.includes('\n- ')) {
        const lines = block.split('\n');
        const intro = lines[0].startsWith('- ') ? null : lines.shift();
        return (
          <div key={i} className="my-4">
            {intro && <p className="text-slate-600 leading-relaxed mb-3">{processInline(intro)}</p>}
            <ul className="space-y-2">
              {lines.filter(l => l.startsWith('- ')).map((line, j) => (
                <li key={j} className="flex gap-3 text-slate-600">
                  <span className="text-primary mt-1.5 flex-shrink-0">•</span>
                  <span className="leading-relaxed">{processInline(line.slice(2))}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      }

      // Numbered list check
      if (block.match(/^\d+\.\s/m) && block.includes('\n')) {
        const lines = block.split('\n');
        return (
          <div key={i} className="my-4 space-y-2">
            {lines.map((line, j) => {
              const numMatch = line.match(/^(\d+)\.\s(.*)/);
              if (numMatch) {
                return (
                  <div key={j} className="flex gap-3 text-slate-600">
                    <span className="text-primary font-semibold min-w-[20px]">{numMatch[1]}.</span>
                    <span className="leading-relaxed">{processInline(numMatch[2])}</span>
                  </div>
                );
              }
              return <p key={j} className="text-slate-600 leading-relaxed">{processInline(line)}</p>;
            })}
          </div>
        );
      }

      // Regular paragraph
      return <p key={i} className="text-slate-600 leading-relaxed my-4">{processInline(block)}</p>;
    });
  };

  // Find adjacent posts
  const currentIdx = BLOG_POSTS.findIndex(p => p.slug === slug);
  const prevPost = currentIdx > 0 ? BLOG_POSTS[currentIdx - 1] : null;
  const nextPost = currentIdx < BLOG_POSTS.length - 1 ? BLOG_POSTS[currentIdx + 1] : null;

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo-transparent.png" alt="myfynzo" className="w-12 h-12 object-contain" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-secondary tracking-tight font-display leading-none">myfynzo</span>
              <span className="text-[10px] font-medium text-primary tracking-[0.15em] mt-1">Your Wealth. Reimagined by AI.</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/blog" className="text-sm text-slate-500 hover:text-secondary transition-colors font-medium">← All posts</Link>
            <Link to="/signup" className="px-5 py-2 bg-secondary text-white text-sm font-semibold rounded-lg hover:bg-secondary/90 transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Cover */}
      <div className={`bg-gradient-to-br ${post.coverGradient} py-16 lg:py-24 px-6 relative overflow-hidden`}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-10 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
        </div>
        <div className="max-w-3xl mx-auto relative text-center">
          <span className="text-7xl mb-6 block">{post.coverEmoji}</span>
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-xs font-bold text-white/70 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">{post.category}</span>
            <span className="text-xs text-white/50">{post.readTime} read</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-white font-display tracking-tight leading-tight mb-4">{post.title}</h1>
          <p className="text-base text-white/60 max-w-xl mx-auto">{post.subtitle}</p>
        </div>
      </div>

      {/* Article Body */}
      <article className="py-12 lg:py-16 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Author + date */}
          <div className="flex items-center gap-3 mb-10 pb-6 border-b border-slate-100">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <img src="/logo-transparent.png" alt="myfynzo" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="text-sm font-semibold text-secondary">{post.author}</div>
              <div className="text-xs text-slate-400">{new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · {post.readTime} read</div>
            </div>
          </div>

          {/* Content */}
          <div className="prose prose-slate max-w-none text-[15px]">
            {renderContent(post.content)}
          </div>

          {/* CTA Box */}
          <div className="mt-12 p-8 bg-gradient-to-br from-secondary to-surface-700 rounded-2xl text-center">
            <h3 className="text-xl font-bold text-white font-display mb-2">Ready to apply these insights?</h3>
            <p className="text-sm text-white/50 mb-6 max-w-sm mx-auto">Open myfynzo and see your real numbers — portfolio, expenses, goals, and AI-powered projections.</p>
            <Link to="/signup" className="inline-block px-7 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
              Start Free — No Card Required
            </Link>
          </div>

          {/* Navigation */}
          <div className="mt-12 pt-8 border-t border-slate-100 grid sm:grid-cols-2 gap-4">
            {prevPost && (
              <Link to={`/blog/${prevPost.slug}`} className="group p-4 rounded-xl border border-slate-200 hover:border-primary/30 transition-all">
                <div className="text-[10px] text-slate-400 mb-1">← Previous</div>
                <div className="text-sm font-semibold text-secondary group-hover:text-primary transition-colors leading-snug">{prevPost.title}</div>
              </Link>
            )}
            {nextPost && (
              <Link to={`/blog/${nextPost.slug}`} className="group p-4 rounded-xl border border-slate-200 hover:border-primary/30 transition-all sm:text-right">
                <div className="text-[10px] text-slate-400 mb-1">Next →</div>
                <div className="text-sm font-semibold text-secondary group-hover:text-primary transition-colors leading-snug">{nextPost.title}</div>
              </Link>
            )}
          </div>
        </div>
      </article>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-100 bg-white text-center">
        <p className="text-xs text-slate-400">© 2026 myfynzo · Your Wealth. Reimagined by AI.</p>
      </footer>
    </div>
  );
}
