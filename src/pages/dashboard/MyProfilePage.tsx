import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Edit2, Eye, ShieldCheck, Star, MapPin, Briefcase, GraduationCap, Heart, User, Calendar, Users, Activity, FileText, AlertTriangle, XCircle, Camera, ChevronLeft, ChevronRight, ChevronDown, BookOpen, Languages, Ruler, Home, Utensils, Wine, Cigarette, Moon, Clock, Mail, MailCheck, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSocketStore } from '../../store/socketStore';
import { getCompleteProfile, setAsProfilePhoto, deletePhoto } from '../../lib/actions/profileActions';
import { CompleteProfile } from '../../lib/types';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import Spinner from '../../components/ui/Spinner';
import { MyProfileSkeleton } from '../../components/ui/Skeletons';
import DocumentUploadSection from '../../components/DocumentUploadSection';
import { apiUrl } from '../../lib/api';

export default function MyProfilePage() {
  const { user, profile , loading: authLoading} = useAuthStore();
  const [activeTab, setActiveTab] = useState('about');
  const [completeProfile, setCompleteProfile] = useState<CompleteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState<string>('about');
  const [resendingEmail, setResendingEmail] = useState(false);

  const handleResendEmail = async () => {
    if (!user?.id) return;
    setResendingEmail(true);
    try {
      const res = await fetch(apiUrl('/api/auth/resend-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: (user?.id || '') })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Verification email sent! Please check your inbox.');
      } else {
        toast.error(data.error || 'Failed to send email.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setResendingEmail(false);
    }
  };

  const fetchCompleteProfile = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await getCompleteProfile((user?.id || ''));
      setCompleteProfile(data);
    } catch (error) {
      console.error('Error fetching complete profile:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchCompleteProfile();
    }
  }, [user?.id, fetchCompleteProfile]);

  // Real-time: re-fetch silently when profile or any section is updated
  useEffect(() => {
    if (!user?.id) return;

    const handleAny = () => fetchCompleteProfile(true);

    let registeredSocket: any = null;
    const registerListeners = (socket: any) => {
      if (!socket || socket === registeredSocket) return;
      if (registeredSocket) {
        registeredSocket.off('profile:updated', handleAny);
        registeredSocket.off('profile:section-updated', handleAny);
        registeredSocket.off('document:status-changed', handleAny);
        registeredSocket.off('profile:public-updated', handleAny);
      }
      socket.on('profile:updated', handleAny);
      socket.on('profile:section-updated', handleAny);
      socket.on('document:status-changed', handleAny);
      socket.on('profile:public-updated', handleAny);
      registeredSocket = socket;
    };

    const currentSocket = useSocketStore.getState().socket;
    if (currentSocket) registerListeners(currentSocket);

    const unsubSocket = useSocketStore.subscribe((state) => {
      if (state.socket) registerListeners(state.socket);
    });

    return () => {
      unsubSocket();
      if (registeredSocket) {
        registeredSocket.off('profile:updated', handleAny);
        registeredSocket.off('profile:section-updated', handleAny);
        registeredSocket.off('document:status-changed', handleAny);
        registeredSocket.off('profile:public-updated', handleAny);
      }
    };
  }, [user?.id, fetchCompleteProfile]);

  const handleSetProfilePhoto = async (photoId: string, photoUrl: string) => {
    try {
      await setAsProfilePhoto((user?.id || ''), photoId, photoUrl);
      toast.success('Profile photo updated successfully!');
      fetchCompleteProfile();
    } catch (error) {
      toast.error('Failed to update profile photo');
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    try {
      await deletePhoto(photoId);
      toast.success('Photo deleted successfully!');
      fetchCompleteProfile();
    } catch (error) {
      toast.error('Failed to delete photo');
    }
  };

  // Guard: wait for auth to be ready before rendering
  if (authLoading || loading || !completeProfile) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <MyProfileSkeleton />
        </div>
      </div>
    );
  }
  if (!user) return null


  const p = completeProfile?.profile || completeProfile;
  const anyP = p as any;
  const edu = completeProfile?.education || anyP?.education_career;
  const fam = completeProfile?.family || anyP?.family_details;
  const life = completeProfile?.lifestyle || anyP?.lifestyle;
  const horo = completeProfile?.horoscope || anyP?.horoscope_details;
  const prefs = completeProfile?.preferences || anyP?.partner_preferences;
  const photos = completeProfile?.photos || anyP?.photos || [];

  const tabs = [
    { id: 'about', label: 'Personal Info' },
    { id: 'education', label: 'Professional Info' },
    { id: 'family', label: 'Family Detail' },
    { id: 'lifestyle', label: 'Lifestyle Info' },
    { id: 'preferences', label: 'Partner Preferences' },
    { id: 'photos', label: 'Photos', count: photos.length },
    { id: 'verification', label: 'Verification Documents' }
  ];

  // Info Card Component for Professional Layout (like ViewProfilePage)
  const InfoCard = ({ title, icon: Icon, children, editStep }: { title: string, icon?: any, children: React.ReactNode, editStep?: number }) => (
    <div className="mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all">
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/80 flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          {Icon && <div className="p-1.5 bg-white rounded-lg shadow-sm"><Icon size={16} className="text-primary-600" /></div>}
          <h3 className="text-[15px] font-bold text-gray-800 tracking-wide">{title}</h3>
        </div>
        {editStep && (
          <Link to={`/complete-profile?step=${editStep}`} className="text-primary-600 hover:text-primary-700 hover:bg-primary-50 px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors">
            <Edit2 size={12} /> Edit
          </Link>
        )}
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
        {children}
      </div>
    </div>
  );

  // Detail Item Component for Grid (like ViewProfilePage)
  const DetailItem = ({ label, value, icon: Icon, fullWidth = false }: { label: string, value: any, icon?: any, fullWidth?: boolean }) => {
    const isEmpty = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
    const displayValue = isEmpty ? 'Not specified' : (Array.isArray(value) ? value.join(', ') : String(value));
    
    return (
      <div className={`flex flex-col gap-1 ${fullWidth ? 'col-span-1 sm:col-span-2' : ''}`}>
        <div className="flex items-center gap-1.5 text-[13px] text-gray-500 font-medium">
          {Icon && <Icon size={14} className="text-gray-400" />}
          {label}
        </div>
        <div className={`text-[15px] font-medium leading-relaxed ${isEmpty ? 'text-gray-400 italic' : 'text-gray-900'}`}>{displayValue}</div>
      </div>
    );
  };

  const renderSectionContent = (tabId: string) => {
    if (tabId === 'about') return (
      <div className="animate-fade-in pt-4">
        {p.about_me && (
          <InfoCard title="About Me" icon={User} editStep={1}>
            <div className="col-span-1 sm:col-span-2 text-gray-600 text-[15px] leading-relaxed whitespace-pre-line">
              {p.about_me}
            </div>
          </InfoCard>
        )}

        <InfoCard title="Basic Details" icon={User} editStep={1}>
          <DetailItem label="Profile For" value={p.profile_for} />
          <DetailItem label="Gender" value={p.gender} />
          <DetailItem label="Date of Birth" value={p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString() : null} icon={Calendar} />
          <DetailItem label="Marital Status" value={p.marital_status} icon={Heart} />
          <DetailItem label="Height" value={p.height_cm ? `${p.height_cm} cm` : null} icon={Ruler} />
          <DetailItem label="Weight" value={p.weight_kg ? `${p.weight_kg} kg` : null} />
          <DetailItem label="Body Type" value={p.body_type} />
          <DetailItem label="Complexion" value={p.complexion} />
          <DetailItem label="Blood Group" value={p.blood_group} />
        </InfoCard>

        <InfoCard title="Background Details" icon={BookOpen} editStep={1}>
          <DetailItem label="Religion" value={p.religion} />
          <DetailItem label="Caste" value={p.caste} />
          <DetailItem label="Sub Caste" value={p.sub_caste} />
          <DetailItem label="Gotra" value={p.gotra} />
          <DetailItem label="Mother Tongue" value={p.mother_tongue} icon={Languages} />
        </InfoCard>
      </div>
    );
    if (tabId === 'education') return (
      <div className="animate-fade-in pt-4">
        <InfoCard title="Education & Career" icon={GraduationCap} editStep={2}>
          <DetailItem label="Highest Education" value={edu?.highest_education} />
          <DetailItem label="Specialization" value={edu?.education_field} />
          <DetailItem label="College" value={edu?.college_name} fullWidth />
          <DetailItem label="Occupation" value={edu?.occupation} icon={Briefcase} />
          <DetailItem label="Company" value={edu?.company_name} />
          <DetailItem label="Designation" value={edu?.designation} />
          <DetailItem label="Annual Income" value={edu?.annual_income} />
          <DetailItem label="Working Location" value={[edu?.working_city, edu?.working_state, edu?.working_country].filter(Boolean).join(', ')} icon={MapPin} fullWidth />
        </InfoCard>
      </div>
    );
    if (tabId === 'family') return (
      <div className="animate-fade-in pt-4">
        <InfoCard title="Family Details" icon={Users} editStep={3}>
          <DetailItem label="Father's Name" value={fam?.father_name} />
          <DetailItem label="Father's Occupation" value={fam?.father_occupation} />
          <DetailItem label="Mother's Name" value={fam?.mother_name} />
          <DetailItem label="Mother's Occupation" value={fam?.mother_occupation} />
          <DetailItem label="Brothers" value={fam?.num_brothers != null ? `${fam?.num_brothers} (${fam?.brothers_married || 0} married)` : null} />
          <DetailItem label="Sisters" value={fam?.num_sisters != null ? `${fam?.num_sisters} (${fam?.sisters_married || 0} married)` : null} />
          <DetailItem label="Family Type" value={fam?.family_type} icon={Home} />
          <DetailItem label="Family Status" value={fam?.family_status} />
          <DetailItem label="Family Values" value={fam?.family_values} />
          <DetailItem label="Native Place" value={fam?.native_place} icon={MapPin} />
          <DetailItem label="Family Location" value={[fam?.family_city, fam?.family_state].filter(Boolean).join(', ')} fullWidth />
          {fam?.about_family && (
            <div className="col-span-1 sm:col-span-2 mt-2">
              <p className="text-[13px] text-gray-500 font-medium mb-1.5">About Family</p>
              <div className="bg-gray-50 rounded-xl p-4 text-[14px] text-gray-700 leading-relaxed">
                {fam.about_family}
              </div>
            </div>
          )}
        </InfoCard>

        <InfoCard title="Mosal (Maternal) Details" icon={Users} editStep={3}>
          <DetailItem label="Mosal Name" value={fam?.mosal_name} />
          <DetailItem label="Mosal State" value={fam?.mosal_state} />
          <DetailItem label="Mosal City" value={fam?.mosal_city} />
          <DetailItem label="Mosal Address" value={fam?.mosal_address} fullWidth />
        </InfoCard>

        {(p as any)?.children_count > 0 && (
          <InfoCard title="Children Details" icon={Users} editStep={3}>
            <DetailItem label="Number of Children" value={(p as any)?.children_count} />
            {(p as any)?.children?.map((child: any, idx: number) => (
              <DetailItem key={idx} label={`Child ${idx + 1}`} value={`${child.name} (${child.gender}, ${child.age} yrs)`} />
            ))}
          </InfoCard>
        )}
      </div>
    );
    if (tabId === 'lifestyle') return (
      <div className="animate-fade-in pt-4">
        <InfoCard title="Lifestyle" icon={Activity} editStep={4}>
          <DetailItem label="Diet" value={life?.diet} icon={Utensils} />
          <DetailItem label="Smoking" value={life?.smoking} icon={Cigarette} />
          <DetailItem label="Drinking" value={life?.drinking} icon={Wine} />
          <DetailItem label="Hobbies" value={life?.hobbies} fullWidth />
          <DetailItem label="Interests" value={life?.interests} fullWidth />
          <DetailItem label="Languages Known" value={life?.languages_known} fullWidth />
        </InfoCard>

        <InfoCard title="Horoscope Details" icon={Star} editStep={4}>
          <DetailItem label="Manglik Status" value={horo?.manglik} icon={Moon} />
          <DetailItem label="Rashi / Moon Sign" value={horo?.rashi} />
          <DetailItem label="Nakshatra" value={horo?.nakshatra} />
          <DetailItem label="Time of Birth" value={horo?.birth_time} icon={Clock} />
          <DetailItem label="Place of Birth" value={horo?.birth_place} icon={MapPin} fullWidth />
        </InfoCard>
      </div>
    );
    if (tabId === 'preferences') return (
      <div className="animate-fade-in pt-4">
        <InfoCard title="Partner Preferences" icon={Heart} editStep={6}>
          <DetailItem label="Age Range" value={prefs?.age_from && prefs?.age_to ? `${prefs.age_from} - ${prefs.age_to} yrs` : null} />
          <DetailItem label="Height Range" value={prefs?.height_from_cm && prefs?.height_to_cm ? `${prefs.height_from_cm} cm - ${prefs.height_to_cm} cm` : null} />
          <DetailItem label="Marital Status" value={prefs?.marital_status_pref} fullWidth />
          <DetailItem label="Religion" value={prefs?.religion_pref} />
          <DetailItem label="Mother Tongue" value={prefs?.mother_tongue_pref} />
          <DetailItem label="Caste" value={prefs?.caste_pref} />
          <DetailItem label="Sub Caste" value={prefs?.sub_caste_pref} />
          <DetailItem label="Education" value={prefs?.education_pref} fullWidth />
          <DetailItem label="Occupation" value={prefs?.occupation_pref} fullWidth />
          <DetailItem label="Income Range" value={prefs?.income_from || prefs?.income_to ? `${prefs.income_from || 'Any'} to ${prefs.income_to || 'Any'}` : null} />
          <DetailItem label="Country" value={prefs?.country_pref} fullWidth />
          <DetailItem label="State" value={prefs?.state_pref} fullWidth />
          <DetailItem label="Diet" value={prefs?.diet_pref} />
          <DetailItem label="Smoking" value={prefs?.smoking_pref} />
          <DetailItem label="Drinking" value={prefs?.drinking_pref} />
          <DetailItem label="Manglik" value={prefs?.manglik_pref} />
          {prefs?.about_partner && (
            <div className="col-span-1 sm:col-span-2 mt-2">
              <p className="text-[13px] text-gray-500 font-medium mb-1.5">Expectations</p>
              <div className="bg-gray-50 rounded-xl p-4 text-[14px] text-gray-700 leading-relaxed">
                {prefs.about_partner}
              </div>
            </div>
          )}
        </InfoCard>
      </div>
    );
    if (tabId === 'photos') return (
      <div className="animate-fade-in pt-4">
        <div className="flex justify-between items-center mb-4 px-2">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Camera className="text-primary" size={18} /> My Photos
          </h2>
          <Link to="/complete-profile?step=5"><Button variant="primary" size="sm">Manage Photos</Button></Link>
        </div>
        {photos && photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {photos.map((photo: any) => (
              <div key={photo.id} className="relative group aspect-[3/4] rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <img src={photo.photo_url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                {photo.is_profile_photo && (
                  <div className="absolute top-2 left-2 bg-primary text-white text-xs font-bold px-2 py-1 rounded-full shadow-md z-10">Profile</div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 z-20">
                  {!photo.is_profile_photo && (
                    <button 
                      onClick={() => handleSetProfilePhoto(photo.id, photo.photo_url)}
                      className="bg-white/20 hover:bg-primary text-white border border-white hover:border-primary px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                    >
                      Set as Profile
                    </button>
                  )}
                  <button 
                    onClick={() => handleDeletePhoto(photo.id)}
                    className="w-9 h-9 bg-red-500/80 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
                    title="Delete Photo"
                  >
                    <XCircle size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-white rounded-2xl border border-gray-200 border-dashed shadow-sm">
            <Camera className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-sm text-gray-600 mb-4">No photos added. Profiles with photos get 10x more responses.</p>
            <Link to="/complete-profile?step=5"><Button variant="outline" size="sm">Upload Photos</Button></Link>
          </div>
        )}
      </div>
    );
    if (tabId === 'verification') return (
      <div className="animate-fade-in pt-4">
        <DocumentUploadSection userId={(user?.id || '')} onUploadComplete={fetchCompleteProfile} />
      </div>
    );
    return null;
  };
  const defaultPhoto = p.gender === 'Female'
    ? 'https://www.uiu.ac.bd/wp-content/uploads/2025/10/female-300n300.jpg'
    : 'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg';
  
  const currentPhoto = p.profile_photo_url || defaultPhoto;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8 group">
          <div className="h-28 sm:h-32 bg-gradient-to-r from-primary-600 to-secondary-500"></div>
          <div className="px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8">

            {/* Avatar row — sits on top of the banner */}
            <div className="flex items-end justify-between -mt-14 sm:-mt-16 mb-4">
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-white">
                  <img
                    src={currentPhoto}
                    alt={p.first_name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = defaultPhoto;
                    }}
                  />
                </div>
                {p.is_verified && (
                  <div className="absolute -bottom-2 -left-2 bg-blue-500 text-white rounded-full p-1.5 shadow" title="Verified Profile">
                    <ShieldCheck size={14} />
                  </div>
                )}
              </div>

              {/* Action buttons — always top-right, never overlap name */}
              <div className="flex gap-2 sm:gap-3 pb-1">
                {p.email_verified ? (
                  <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4">
                    <Eye size={15} /> <span className="hidden xs:inline">Preview</span><span className="xs:hidden">Preview</span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4 text-amber-700 border-amber-300 hover:bg-amber-50"
                    onClick={handleResendEmail}
                    disabled={resendingEmail}
                  >
                    {resendingEmail ? (
                      <><RefreshCw size={14} className="animate-spin" /> <span className="hidden sm:inline">Sending...</span></>
                    ) : (
                      <><Mail size={14} /> <span className="hidden sm:inline">Resend Email</span></>
                    )}
                  </Button>
                )}
                <Link to="/complete-profile">
                  <Button variant="primary" size="sm" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4">
                    <Edit2 size={15} /> <span>Edit Profile</span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Name + details — full width, no overlap */}
            <div className="w-full">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
                  {p.first_name} {p.last_name}
                </h1>
                {p.is_verified && <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-semibold whitespace-nowrap"><ShieldCheck size={12} /> Verified</span>}
                {p.is_premium && <span className="bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-semibold shadow-sm whitespace-nowrap"><Star size={12} className="text-yellow-600" /> Premium</span>}
              </div>

              <div className="flex items-center flex-wrap gap-2 text-sm text-gray-500 font-medium mb-3">
                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 whitespace-nowrap">ID: {p.profile_id}</span>
                {edu?.working_city && (
                  <span className="flex items-center gap-1 text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                    <MapPin size={13} className="text-gray-400 shrink-0"/>
                    {edu.working_city}{edu.working_state ? `, ${edu.working_state}` : ''}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
                {p.date_of_birth && <span className="flex items-center gap-1.5 whitespace-nowrap"><Calendar size={13} className="text-gray-400" /> {new Date().getFullYear() - new Date(p.date_of_birth).getFullYear()} yrs</span>}
                {p.height_cm && <span className="flex items-center gap-1.5 whitespace-nowrap"><Ruler size={13} className="text-gray-400" /> {p.height_cm} cm</span>}
                {p.religion && <span className="flex items-center gap-1.5"><BookOpen size={13} className="text-gray-400 shrink-0" /> {p.religion}{p.caste ? `, ${p.caste}` : ''}{p.sub_caste ? ` (${p.sub_caste})` : ''}</span>}
                {edu?.highest_education && <span className="flex items-center gap-1.5 whitespace-nowrap"><GraduationCap size={13} className="text-gray-400" /> {edu.highest_education}</span>}
                {edu?.occupation && <span className="flex items-center gap-1.5 whitespace-nowrap"><Briefcase size={13} className="text-gray-400" /> {edu.occupation}</span>}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {p.is_verified ? (
                  <Badge variant="verified" />
                ) : (
                  <Link to="/my-profile?tab=verification">
                    <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 hover:bg-orange-200 transition-colors cursor-pointer border border-orange-200">
                      <AlertTriangle size={12} className="mr-1" /> Unverified - Upload Aadhaar
                    </span>
                  </Link>
                )}
                {p.email_verified ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-200">
                    <MailCheck size={12} className="mr-1" /> Email Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 border border-yellow-200">
                    <Mail size={12} className="mr-1" /> Email Not Verified
                  </span>
                )}
                {p.is_premium && <Badge variant="premium" />}
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-gray-100">
              <div className="max-w-md">
                <ProgressBar 
                  percentage={p.profile_completion || 50} 
                  showLabel 
                  color={p.profile_completion === 100 ? 'bg-green-500' : 'bg-primary'}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Complete your profile to get more matches and better visibility.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── MOBILE/TABLET ACCORDION VIEW (below md) ── */}
        <div className="md:hidden space-y-3">
          {tabs.map((tab) => {
            const isOpen = openSection === tab.id;
            return (
              <div key={tab.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setOpenSection(isOpen ? '' : tab.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-800"
                >
                  <span className="flex items-center gap-2">
                    {tab.id === 'about' && <User size={16} className="text-primary" />}
                    {tab.id === 'education' && <GraduationCap size={16} className="text-primary" />}
                    {tab.id === 'family' && <Users size={16} className="text-primary" />}
                    {tab.id === 'lifestyle' && <Activity size={16} className="text-primary" />}
                    {tab.id === 'preferences' && <Heart size={16} className="text-primary" />}
                    {tab.id === 'photos' && <Camera size={16} className="text-primary" />}
                    {tab.id === 'verification' && <ShieldCheck size={16} className="text-primary" />}
                    {tab.label}
                  </span>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-5 border-t border-gray-50">
                    {renderSectionContent(tab.id)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── DESKTOP TAB VIEW (md and above) ── */}
        <div className="mt-6 bg-white rounded-2xl shadow-md overflow-hidden hidden md:block">
          <div className="border-b overflow-x-auto">
            <div className="flex min-w-max">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap transition border-b-2 ${
                    activeTab === tab.id
                      ? 'text-primary border-primary bg-primary-50/50'
                      : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`ml-2 py-0.5 px-2 rounded-full text-xs font-medium ${activeTab === tab.id ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="p-6 sm:p-8 bg-gray-50/30">
            {renderSectionContent(activeTab)}
          </div>
        </div>
      </div>
    </div>
  );
}
