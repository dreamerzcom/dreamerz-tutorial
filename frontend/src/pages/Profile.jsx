import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { UserCircle2, Mail, CalendarDays, Clock3, MapPin, Phone, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { SEO } from '../components/SEO';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';

const formatDateTime = (value) => {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return date.toLocaleString();
};

export const Profile = () => {
  const { user, isAuthenticated, isLoaded, updateProfile } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    bio: ''
  });

  useEffect(() => {
    if (!user) return;

    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
      location: user.location || '',
      bio: user.bio || ''
    });
  }, [user]);

  if (isLoaded && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-slate-50 pt-24 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const handleChange = (field) => (event) => {
    setFormData((current) => ({
      ...current,
      [field]: event.target.value
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    updateProfile(formData);
    toast.success('Profile updated successfully.');
  };

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;

  return (
    <>
      <SEO title="My Profile" description="View and edit your DreamerZ profile details." />
      <div className="min-h-screen bg-slate-50 pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 h-fit">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <UserCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{displayName}</h1>
                  <p className="text-sm text-slate-500">@{user.username}</p>
                </div>
              </div>

              <div className="space-y-4 text-sm text-slate-600">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 mt-0.5 text-slate-400" />
                  <span>{user.email}</span>
                </div>
                <div className="flex items-start gap-3">
                  <Clock3 className="w-4 h-4 mt-0.5 text-slate-400" />
                  <div>
                    <div className="font-medium text-slate-700">Last login</div>
                    <div>{formatDateTime(user.lastLoginAt)}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CalendarDays className="w-4 h-4 mt-0.5 text-slate-400" />
                  <div>
                    <div className="font-medium text-slate-700">Account created</div>
                    <div>{formatDateTime(user.createdAt)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Profile details</h2>
                <p className="text-slate-600 mt-2">Keep your personal details up to date.</p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid sm:grid-cols-2 gap-5">
                  <label className="block text-sm font-medium text-slate-700">
                    First name
                    <input
                      value={formData.firstName}
                      onChange={handleChange('firstName')}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="First name"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Last name
                    <input
                      value={formData.lastName}
                      onChange={handleChange('lastName')}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="Last name"
                    />
                  </label>
                </div>

                <label className="block text-sm font-medium text-slate-700">
                  Email address
                  <input
                    type="email"
                    value={formData.email}
                    readOnly
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500 outline-none cursor-not-allowed"
                    placeholder="email@example.com"
                  />
                </label>

                <div className="grid sm:grid-cols-2 gap-5">
                  <label className="block text-sm font-medium text-slate-700">
                    <span className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      Phone
                    </span>
                    <input
                      value={formData.phone}
                      onChange={handleChange('phone')}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="Phone number"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    <span className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      Location
                    </span>
                    <input
                      value={formData.location}
                      onChange={handleChange('location')}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="City, State"
                    />
                  </label>
                </div>

                <label className="block text-sm font-medium text-slate-700">
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    Bio
                  </span>
                  <textarea
                    value={formData.bio}
                    onChange={handleChange('bio')}
                    rows={5}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                    placeholder="Tell us a bit about yourself"
                  />
                </label>

                <div className="flex justify-end">
                  <Button type="submit">Save profile</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Profile;
