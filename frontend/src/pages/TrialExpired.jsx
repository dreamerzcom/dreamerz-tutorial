import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Mail, ArrowLeft, BookOpen } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { SEO } from '../components/SEO';

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
};

export const TrialExpired = () => {
  const { user, isAuthenticated } = useAuth();
  const expiry = formatDate(user?.trialExpiresAt);

  return (
    <>
      <SEO title="Free trial ended" description="Your 45-day DreamerZ free trial has ended." />
      <div className="min-h-screen bg-slate-50 pt-24 pb-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-10 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
              Your 45-day free trial has ended
            </h1>

            <p className="text-slate-600 leading-relaxed mb-8 max-w-lg mx-auto">
              {expiry
                ? <>Your trial ended on <strong>{expiry}</strong>. </>
                : null}
              Lessons, quizzes and the in-lesson AI chat are now paused. You can
              still view your account and browse the catalog while we sort out
              a plan that works for you.
            </p>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 mb-8 text-left">
              <h2 className="font-semibold text-slate-900 mb-2 text-sm uppercase tracking-wide">
                What's still available
              </h2>
              <ul className="text-sm text-slate-700 space-y-1.5">
                <li>• Browse all courses and categories</li>
                <li>• View your account details</li>
                <li>• See your past progress (read-only)</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/learn"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50"
              >
                <BookOpen className="w-4 h-4" />
                Browse catalog
              </Link>
              <a
                href="mailto:hello@dreamerz.example?subject=Continue%20past%20trial"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90"
              >
                <Mail className="w-4 h-4" />
                Contact us to continue
              </a>
            </div>

            {isAuthenticated && (
              <Link
                to="/account"
                className="mt-6 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="w-3 h-3" />
                Back to my account
              </Link>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default TrialExpired;
