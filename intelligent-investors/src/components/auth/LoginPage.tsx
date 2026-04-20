import * as React from 'react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useNavigate, Link } from 'react-router-dom';

export function LoginPage() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, new GoogleAuthProvider());
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center py-8">
          <h1 className="font-serif italic text-3xl">Welcome Back</h1>
          <p className="text-[10px] font-mono uppercase opacity-50 mt-2 tracking-widest">Intelligent Investors Workspace</p>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleEmailLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-mono uppercase opacity-50 mb-1 tracking-widest">Email Address</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="investor@example.com"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase opacity-50 mb-1 tracking-widest">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-xs text-red-600 font-mono">{error}</p>}
            <Button type="submit" className="w-full py-4" disabled={loading}>
              {loading ? 'Authenticating...' : 'Enter Workspace'}
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--line)] opacity-20"></div>
            </div>
            <div className="relative flex justify-center text-[10px] font-mono uppercase tracking-widest">
              <span className="bg-white px-4 opacity-50">Or continue with</span>
            </div>
          </div>

          <Button variant="outline" className="w-full py-4 flex items-center gap-3" onClick={handleGoogleLogin} disabled={loading}>
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" referrerPolicy="no-referrer" />
            Google Account
          </Button>

          <p className="text-center mt-8 text-xs font-mono opacity-50">
            New to the system? <Link to="/signup" className="underline hover:text-[var(--ink)]">Create Account</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
