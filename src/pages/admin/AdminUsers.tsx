import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Search, MoreVertical, 
  Shield, ShieldOff, UserCheck, UserX, 
  Star, StarOff, ExternalLink, ChevronLeft, ChevronRight, Plus, X, 
  Users, Crown, Mail, Phone, Hash, MapPin, Edit3, Save, SlidersHorizontal, CheckCircle2, Eye,
  User, Heart, Briefcase, Users as UsersIcon, Upload, FileText, Camera, CheckCircle, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAdminUsers, updateUserField, adminAddProfile, adminBulkUpdateProfile } from '../../lib/actions/adminActions';
import { uploadProfilePhoto } from '../../lib/actions/profileActions';
import { uploadDocument } from '../../lib/actions/authActions';
import { 
  profileForOptions, maritalStatusOptions, heightOptions, 
  motherTongueOptions, educationOptions, occupationOptions, incomeOptions, 
  familyTypeOptions, bodyTypeOptions, manglikOptions, rashiOptions, nakshatraOptions,
  dietOptions, smokingDrinkingOptions, complexionOptions, familyStatusOptions,
  familyValuesOptions, bloodGroupOptions
} from '../../lib/constants';
import { useMasterData } from '../../store/masterDataStore';
import { useSocketStore } from '../../store/socketStore';
import { State, City } from 'country-state-city';
import Spinner from '../../components/ui/Spinner';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import { AdminTableSkeleton } from '../../components/ui/Skeletons';
import { apiUrl } from '../../lib/api';

export default function AdminUsers() {
  const location = useLocation();
  const { castes, admin_settings_kv, getSubCastesByCaste } = useMasterData();
  
  const communityNameSetting = admin_settings_kv?.find((s: any) => s.key === 'community_name');
  const rawCommunityName = communityNameSetting?.value;
  const isPlaceholder = !rawCommunityName || rawCommunityName === 'Your Community';
  const communityName = isPlaceholder ? 'Lohana' : rawCommunityName;
  
  const indiaStates = State.getStatesOfCountry('IN');
  const mappedStates = indiaStates.map(s => ({ value: s.name, label: s.name, isoCode: s.isoCode }));
  
  const targetCasteOptions = [{ value: communityName, label: communityName }];
  const mappedSubCastes = getSubCastesByCaste(castes.find((c: any) => c.name === communityName)?.id || '').map((s: any) => ({ value: s.name, label: s.name }));
  const subCasteFallback = mappedSubCastes.length === 0 ? [{ value: 'Halai', label: 'Halai' }, { value: 'Ghoghari', label: 'Ghoghari' }, { value: 'Kutchi', label: 'Kutchi' }] : mappedSubCastes;

  const [users, setUsers] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: location.state?.search || '',
    search_field: location.state?.search_field || 'all',
    gender: location.state?.gender || 'all',
    verified: location.state?.verified || 'all',
    active: 'all',
    premium: location.state?.premium || 'all',
    blocked: 'all',
    caste: '',
    city: location.state?.city || '',
    age_min: location.state?.age_min || '',
    age_max: location.state?.age_max || '',
    email_verified: 'all',
    doc_verified: 'all'
  });
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProfile, setNewProfile] = useState({
    profile_for: 'Self', first_name: '', last_name: '', gender: 'Male', date_of_birth: '',
    phone: '', religion: 'Hindu', caste: communityName, sub_caste: '', gotra: '', mother_tongue: 'Gujarati',
    manglik: '', rashi: '', nakshatra: '', birth_time: '', birth_place: '',
    state: '', city: '', highest_education: '', occupation: '', annual_income: '',
    height_cm: '', weight_kg: '', body_type: '', complexion: '', blood_group: '',
    physical_disability: 'No', disability_desc: '', marital_status: 'Never Married',
    diet: '', smoking: '', drinking: '',
    children_count: '0', children: [] as {name: string, gender: string, age: string}[],
    family_type: '', family_status: '', family_values: '',
    father_name: '', father_occupation: '', mother_name: '', mother_occupation: '',
    brothers: '0', married_brothers: '0', sisters: '0', married_sisters: '0',
    mosal_name: '', mosal_state: '', mosal_city: '', mosal_address: '', family_income: '',
    about_me: ''
  });
  const [addingProfile, setAddingProfile] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [editLoading, setEditLoading] = useState(false);

  // File upload state (shared for both Add & Edit)
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string>('');
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const [aadhaarFront, setAadhaarFront] = useState<File | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<File | null>(null);
  const aadhaarFrontRef = useRef<HTMLInputElement>(null);
  const aadhaarBackRef = useRef<HTMLInputElement>(null);
  const [biodataFile, setBiodataFile] = useState<File | null>(null);
  const biodataFileRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const resetFileState = () => {
    setProfilePhotoFile(null); setProfilePhotoPreview('');
    setAadhaarFront(null); setAadhaarBack(null); setBiodataFile(null);
  };

  // ── Import/Export Handlers ─────────────────────────────────────────────────

  const TEMPLATE_COLUMNS = [
    'first_name','last_name','email','phone','gender','profile_for','date_of_birth',
    'religion','caste','sub_caste','gotra','mother_tongue','manglik','rashi','nakshatra',
    'birth_time','birth_place','state','city','highest_education','occupation','annual_income',
    'height_cm','weight_kg','body_type','complexion','blood_group','physical_disability',
    'disability_desc','marital_status','diet','smoking','drinking',
    'family_type','family_status','family_values','father_name','father_occupation',
    'mother_name','mother_occupation','brothers','married_brothers','sisters','married_sisters',
    'mosal_name','mosal_state','mosal_city','mosal_address','family_income','about_me',
    'profile_photo_url','aadhaar_verified'
  ];

  const handleExportUsers = async () => {
    try {
      toast.loading('Exporting users...', { id: 'export' });
      const token = localStorage.getItem('atmilan-token');
      const res = await fetch(apiUrl('/api/admin/users/export'), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(data.users);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Users');
      XLSX.writeFile(wb, `users_export_${new Date().toISOString().slice(0,10)}.xlsx`);
      toast.success(`Exported ${data.count} users`, { id: 'export' });
    } catch (err: any) {
      toast.error(err.message || 'Export failed', { id: 'export' });
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const sampleRow = {
        first_name: 'John', last_name: 'Doe', email: 'john@example.com', phone: '9876543210',
        gender: 'Male', profile_for: 'Self', date_of_birth: '1995-01-15',
        religion: 'Hindu', caste: 'Lohana', sub_caste: 'Halai', gotra: '', mother_tongue: 'Gujarati',
        manglik: 'No', rashi: '', nakshatra: '', birth_time: '', birth_place: '',
        state: 'Gujarat', city: 'Ahmedabad', highest_education: 'B.Tech', occupation: 'Software Engineer',
        annual_income: '8-10 Lakh', height_cm: '175', weight_kg: '70', body_type: 'Average',
        complexion: 'Fair', blood_group: 'O+', physical_disability: 'No', disability_desc: '',
        marital_status: 'Never Married', diet: 'Vegetarian', smoking: 'No', drinking: 'No',
        family_type: 'Joint', family_status: 'Middle Class', family_values: 'Traditional',
        father_name: 'Ram Doe', father_occupation: 'Business', mother_name: 'Sita Doe', mother_occupation: 'Homemaker',
        brothers: '1', married_brothers: '0', sisters: '1', married_sisters: '1',
        mosal_name: '', mosal_state: '', mosal_city: '', mosal_address: '', family_income: '10-15 Lakh',
        about_me: 'Looking for a life partner',
        profile_photo_url: 'https://example.com/photo.jpg',
        aadhaar_verified: 'Yes',
      };

      // Build dropdown reference sheet — each field as a column, options as rows
      const dropdownFields: Record<string, string[]> = {
        gender: ['Male', 'Female'],
        profile_for: ['Self', 'Son', 'Daughter', 'Brother', 'Sister', 'Friend', 'Relative'],
        religion: ['Hindu'],
        caste: ['Lohana'],
        sub_caste: ['Halai', 'Ghoghari', 'Kutchi', 'Vaishnav', 'Swaminarayan', 'Jain', 'Other'],
        mother_tongue: ['Gujarati', 'Hindi', 'English', 'Marathi', 'Kutchi', 'Sindhi'],
        manglik: ['Yes', 'No', 'Partial', 'Not Sure'],
        rashi: ['Mesh', 'Vrushabh', 'Mithun', 'Kark', 'Sinh', 'Kanya', 'Tula', 'Vrushchik', 'Dhanu', 'Makar', 'Kumbh', 'Meen'],
        nakshatra: ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'],
        highest_education: ['Below 10th', '10th Pass', '12th Pass', 'Diploma', 'B.Com', 'B.Sc', 'B.Tech', 'BBA', 'BCA', 'BA', 'MBBS', 'B.Pharm', 'LLB', 'M.Com', 'M.Sc', 'M.Tech', 'MBA', 'MCA', 'MA', 'MD', 'M.Pharm', 'LLM', 'PhD', 'CA', 'CS', 'ICWA', 'Other'],
        occupation: ['Software Engineer', 'Doctor', 'Business', 'Teacher', 'Government Job', 'Private Job', 'Self Employed', 'Farmer', 'Engineer', 'Accountant', 'Lawyer', 'Architect', 'Designer', 'Manager', 'Consultant', 'Other'],
        annual_income: ['Below 2 Lakh', '2-4 Lakh', '4-6 Lakh', '6-8 Lakh', '8-10 Lakh', '10-15 Lakh', '15-20 Lakh', '20-30 Lakh', '30-50 Lakh', '50 Lakh+', 'Not Disclosed'],
        body_type: ['Slim', 'Average', 'Athletic', 'Heavy'],
        complexion: ['Very Fair', 'Fair', 'Wheatish', 'Dark'],
        blood_group: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        physical_disability: ['No', 'Yes'],
        marital_status: ['Never Married', 'Divorced', 'Widowed', 'Awaiting Divorce', 'Annulled', 'Engagement Broken'],
        diet: ['Vegetarian', 'Non-Vegetarian', 'Eggetarian', 'Jain', 'Vegan'],
        smoking: ['No', 'Yes', 'Occasionally'],
        drinking: ['No', 'Yes', 'Occasionally'],
        family_type: ['Joint', 'Nuclear'],
        family_status: ['Middle Class', 'Upper Middle Class', 'Rich', 'Affluent'],
        family_values: ['Traditional', 'Moderate', 'Liberal'],
        aadhaar_verified: ['Yes', 'No'],
      };

      // Convert to column-based format: field names as headers, options as rows
      const fieldNames = Object.keys(dropdownFields);
      const maxRows = Math.max(...Object.values(dropdownFields).map(arr => arr.length));
      const dropdownRows: Record<string, string>[] = [];
      for (let i = 0; i < maxRows; i++) {
        const row: Record<string, string> = {};
        for (const field of fieldNames) {
          row[field] = dropdownFields[field][i] || '';
        }
        dropdownRows.push(row);
      }

      const ws1 = XLSX.utils.json_to_sheet([sampleRow]);
      const ws2 = XLSX.utils.json_to_sheet(dropdownRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, 'Import Template');
      XLSX.utils.book_append_sheet(wb, ws2, 'Dropdown Options');
      XLSX.writeFile(wb, 'user_import_template.xlsx');
      toast.success('Template downloaded! Check "Dropdown Options" sheet for valid values.');
    } catch (err: any) {
      toast.error('Failed to generate template');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // Reset so same file can be re-selected

    // If user selects a file with no data, offer template download
    toast.loading('Processing file...', { id: 'import' });

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);

      if (rows.length === 0) {
        toast.error('File is empty. Download the template first.', { id: 'import' });
        return;
      }

      // Confirm with user
      if (!window.confirm(`Found ${rows.length} rows. Import all?`)) {
        toast.dismiss('import');
        return;
      }

      const token = localStorage.getItem('atmilan-token');
      const res = await fetch(apiUrl('/api/admin/users/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ users: rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      toast.success(`Imported: ${data.imported} | Skipped: ${data.skipped}`, { id: 'import' });
      if (data.errors?.length > 0) {
        console.warn('Import errors:', data.errors);
        toast.error(`${data.errors.length} rows had issues. Check console.`, { duration: 5000 });
      }
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Import failed', { id: 'import' });
    }
  };

  const limit = 20;

  const { socket } = useSocketStore();
  const fetchUsersRef = useRef<() => void>(() => {});

  useEffect(() => {
    fetchUsers();
    // Poll every 10 seconds for real-time user management updates
    const poll = setInterval(() => fetchUsersRef.current(), 10000);
    const onVisible = () => { if (document.visibilityState === 'visible') fetchUsersRef.current(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [page, filters]);

  // Keep ref up-to-date every render
  useEffect(() => { fetchUsersRef.current = fetchUsers; });

  // Real-time: bind directly to raw socket with stable ref callbacks
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchUsersRef.current();
    const events = [
      'admin:new-user', 'admin:profile-updated', 'admin:doc-status-changed',
      'admin:user-deleted', 'admin:interest-sent', 'admin:user-reported',
      'admin:user-blocked', 'admin:user-unblocked',
    ];
    events.forEach(evt => socket.on(evt, handler));
    const onReconnect = () => events.forEach(evt => { socket.off(evt, handler); socket.on(evt, handler); });
    socket.on('connect', onReconnect);
    return () => {
      events.forEach(evt => socket.off(evt, handler));
      socket.off('connect', onReconnect);
    };
  }, [socket]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await getAdminUsers(page, limit, filters);
      setUsers(res.users);
      setTotalCount(res.totalCount);
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleField = async (userId: string, field: string, currentValue: boolean) => {
    try {
      await updateUserField(userId, field, !currentValue);
      toast.success(`User ${field.replace('is_', '')} status updated`);
      fetchUsers();
      setActiveMenu(null);
    } catch (error) {
      toast.error('Failed to update user');
    }
  };

  const handleAddProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingProfile(true);
    try {
      const result = await adminAddProfile(newProfile);
      const newId = result.profile?.id;
      // Upload files if any
      if (newId) {
        if (profilePhotoFile) await uploadProfilePhoto(newId, profilePhotoFile).catch(console.error);
        if (aadhaarFront) await uploadDocument(newId, aadhaarFront, 'aadhaar_front').catch(console.error);
        if (aadhaarBack) await uploadDocument(newId, aadhaarBack, 'aadhaar_back').catch(console.error);
        if (biodataFile) await uploadDocument(newId, biodataFile, 'biodata').catch(console.error);
      }
      toast.success('Profile added successfully');
      setShowAddModal(false);
      fetchUsers();
      resetFileState();
      setNewProfile({
        profile_for: 'Self', first_name: '', last_name: '', gender: 'Male', date_of_birth: '',
        phone: '', religion: 'Hindu', caste: communityName, sub_caste: '', gotra: '', mother_tongue: 'Gujarati',
        manglik: '', rashi: '', nakshatra: '', birth_time: '', birth_place: '',
        state: '', city: '', highest_education: '', occupation: '', annual_income: '',
        height_cm: '', weight_kg: '', body_type: '', complexion: '', blood_group: '',
        physical_disability: 'No', disability_desc: '', marital_status: 'Never Married',
        diet: '', smoking: '', drinking: '',
        children_count: '0', children: [] as {name: string, gender: string, age: string}[],
        family_type: '', family_status: '', family_values: '',
        father_name: '', father_occupation: '', mother_name: '', mother_occupation: '',
        brothers: '0', married_brothers: '0', sisters: '0', married_sisters: '0',
        mosal_name: '', mosal_state: '', mosal_city: '', mosal_address: '', family_income: '',
        about_me: ''
      });
    } catch (error) {
      console.error('Error adding profile:', error);
      toast.error('Failed to add profile');
    } finally {
      setAddingProfile(false);
    }
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    setEditLoading(true);
    try {
      const { id, profile_id, email, profile_photo_url, is_verified, is_premium, is_active, is_permanently_blocked, blocked_until, block_reason, created_at, updated_at, role, ...updates } = editUser;
      await adminBulkUpdateProfile(editUser.id, updates);
      // Upload files if any
      if (profilePhotoFile) await uploadProfilePhoto(editUser.id, profilePhotoFile).catch(console.error);
      if (aadhaarFront) await uploadDocument(editUser.id, aadhaarFront, 'aadhaar_front').catch(console.error);
      if (aadhaarBack) await uploadDocument(editUser.id, aadhaarBack, 'aadhaar_back').catch(console.error);
      if (biodataFile) await uploadDocument(editUser.id, biodataFile, 'biodata').catch(console.error);
      toast.success('Profile updated successfully');
      setEditUser(null);
      resetFileState();
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setEditLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

  const getAge = (dob: string) => {
    if (!dob) return '-';
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  const optArr = (arr: string[]) => arr.map(v => <option key={v} value={v}>{v}</option>);
  const optVal = (arr: {value: string|number, label: string}[]) => arr.map(v => <option key={String(v.value)} value={String(v.value)}>{v.label}</option>);
  const INP = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-1 focus:ring-primary focus:border-primary';
  const SEL = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-1 focus:ring-primary';
  const LBL = (label: string) => <label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">{label}</label>;

  const renderProfileFields = (data: any, setter: (v: any) => void) => {
    // Use functional setter to avoid stale data when setting multiple fields
    const set = (field: string, value: any) => setter(prev => ({ ...prev, [field]: value }));
    const val = (field: string) => data[field] || '';
    // Multi-set: merge multiple fields at once (avoids stale data issue)
    const setMulti = (updates: Record<string, any>) => setter(prev => ({ ...prev, ...updates }));

    // Cascading city lists from country-state-city (same as registration)
    const stateIsoCode = val('state') ? indiaStates.find(s => s.name === val('state'))?.isoCode : '';
    const mappedCities = stateIsoCode
      ? City.getCitiesOfState('IN', stateIsoCode).map(c => ({ value: c.name, label: c.name }))
      : [];
    const mosalStateIsoCode = val('mosal_state') ? indiaStates.find(s => s.name === val('mosal_state'))?.isoCode : '';
    const mappedMosalCities = mosalStateIsoCode
      ? City.getCitiesOfState('IN', mosalStateIsoCode).map(c => ({ value: c.name, label: c.name }))
      : [];

    // Children details for divorced/widowed (same as registration step 8)
    const showChildren = ['Divorced', 'Widowed', 'Awaiting Divorce', 'Annulled', 'Engagement Broken'].includes(val('marital_status'));

    // Existing documents for edit mode
    const existingDocs = val('documents') || {};
    const hasAadhaarFront = !!existingDocs.aadhaar_front_url;
    const hasAadhaarBack = !!existingDocs.aadhaar_back_url;
    const hasBiodata = !!existingDocs.biodata_url;

    return (
      <>
        {/* Step 1: Profile For & Gender */}
        <div className="border-b border-gray-100 pb-4 mb-4">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5"><User size={12} /> Profile For & Gender</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>{LBL('Profile For')}<select value={val('profile_for')} onChange={e => set('profile_for', e.target.value)} className={SEL}>{optArr(profileForOptions)}</select></div>
            <div className="md:col-span-2">
              {LBL('Gender')}
              <div className="grid grid-cols-2 gap-2">
                <div onClick={() => set('gender', 'Male')} className={`border-2 rounded-lg p-2 cursor-pointer text-center transition-all text-sm ${val('gender') === 'Male' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
                  <span className="text-lg">👨</span><span className="ml-1 font-medium">Male</span>
                </div>
                <div onClick={() => set('gender', 'Female')} className={`border-2 rounded-lg p-2 cursor-pointer text-center transition-all text-sm ${val('gender') === 'Female' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
                  <span className="text-lg">👩</span><span className="ml-1 font-medium">Female</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Step 2: Name & DOB */}
        <div className="border-b border-gray-100 pb-4 mb-4">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5"><User size={12} /> Name & Date of Birth</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>{LBL('First Name')}<input value={val('first_name')} onChange={e => set('first_name', e.target.value)} className={INP} /></div>
            <div>{LBL('Last Name')}<input value={val('last_name')} onChange={e => set('last_name', e.target.value)} className={INP} /></div>
            <div>{LBL('Date of Birth')}<input type="date" value={val('date_of_birth')?.split('T')[0] || ''} onChange={e => set('date_of_birth', e.target.value)} className={INP} /></div>
          </div>
        </div>
        {/* Step 3: Contact */}
        <div className="border-b border-gray-100 pb-4 mb-4">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5"><Phone size={12} /> Contact</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>{LBL('Phone')}<input type="tel" value={val('phone')} onChange={e => set('phone', e.target.value)} className={INP} /></div>
          </div>
        </div>
        {/* Step 4: Community & Astrology - Same as Registration */}
        <div className="border-b border-gray-100 pb-4 mb-4">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5"><Heart size={12} /> Community & Astrology</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>{LBL('Religion')}<select value="Hindu" disabled className={SEL}><option value="Hindu">Hindu</option></select></div>
            <div>{LBL('Caste')}<select value={communityName} disabled className={SEL}>{targetCasteOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
            <div>{LBL('Sub Caste')}<select value={val('sub_caste')} onChange={e => set('sub_caste', e.target.value)} className={SEL} disabled={subCasteFallback.length === 0}><option value="">Select</option>{subCasteFallback.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
            <div>{LBL('Gotra')}<input value={val('gotra')} onChange={e => set('gotra', e.target.value)} className={INP} /></div>
            <div>{LBL('Mother Tongue')}<select value={val('mother_tongue')} onChange={e => set('mother_tongue', e.target.value)} className={SEL}><option value="">Select</option>{optArr(motherTongueOptions)}</select></div>
          </div>
          <div className="border-t border-gray-100 mt-4 pt-4">
            <h5 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><Star size={12} className="text-primary" /> Astrological Details</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>{LBL('Manglik')}<select value={val('manglik')} onChange={e => set('manglik', e.target.value)} className={SEL}><option value="">Select</option>{optArr(manglikOptions)}</select></div>
              <div>{LBL('Rashi')}<select value={val('rashi')} onChange={e => set('rashi', e.target.value)} className={SEL}><option value="">Select</option>{optArr(rashiOptions)}</select></div>
              <div>{LBL('Nakshatra')}<select value={val('nakshatra')} onChange={e => set('nakshatra', e.target.value)} className={SEL}><option value="">Select</option>{optArr(nakshatraOptions)}</select></div>
              <div>{LBL('Birth Time')}<input type="time" value={val('birth_time')} onChange={e => set('birth_time', e.target.value)} className={INP} /></div>
              <div>{LBL('Birth Place')}<input value={val('birth_place')} onChange={e => set('birth_place', e.target.value)} className={INP} placeholder="City, State" /></div>
            </div>
          </div>
        </div>
        {/* Step 5: Location - Same as Registration with cascading state/city */}
        <div className="border-b border-gray-100 pb-4 mb-4">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5"><MapPin size={12} /> Location</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>{LBL('State')}<select value={val('state')} onChange={e => setMulti({ state: e.target.value, city: '' })} className={SEL}><option value="">Select State</option>{mappedStates.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
            <div>{LBL('City / Taluka')}<select value={val('city')} onChange={e => set('city', e.target.value)} className={SEL} disabled={!val('state')}><option value="">Select City</option>{mappedCities.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
          </div>
        </div>
        {/* Step 6: Education & Career */}
        <div className="border-b border-gray-100 pb-4 mb-4">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5"><Briefcase size={12} /> Education & Career</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>{LBL('Highest Education')}<select value={val('highest_education')} onChange={e => set('highest_education', e.target.value)} className={SEL}><option value="">Select</option>{optArr(educationOptions)}</select></div>
            <div>{LBL('Occupation')}<select value={val('occupation')} onChange={e => set('occupation', e.target.value)} className={SEL}><option value="">Select</option>{optArr(occupationOptions)}</select></div>
            <div>{LBL('Annual Income')}<select value={val('annual_income')} onChange={e => set('annual_income', e.target.value)} className={SEL}><option value="">Select</option>{optArr(incomeOptions)}</select></div>
          </div>
        </div>
        {/* Step 7: Physical Attributes & Lifestyle */}
        <div className="border-b border-gray-100 pb-4 mb-4">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5"><User size={12} /> Physical Attributes</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>{LBL('Marital Status')}<select value={val('marital_status')} onChange={e => { const ms = e.target.value; setMulti({ marital_status: ms, ...(showChildren && !['Divorced', 'Widowed', 'Awaiting Divorce', 'Annulled', 'Engagement Broken'].includes(ms) ? { children_count: '0', children: [] } : {}) }); }} className={SEL}><option value="">Select</option>{optArr(maritalStatusOptions)}</select></div>
            <div>{LBL('Height')}<select value={val('height_cm')} onChange={e => set('height_cm', e.target.value)} className={SEL}><option value="">Select</option>{optVal(heightOptions)}</select></div>
            <div>{LBL('Weight (kg)')}<input type="number" min="0" value={val('weight_kg')} onChange={e => set('weight_kg', e.target.value)} className={INP} placeholder="e.g. 65" /></div>
            <div>{LBL('Body Type')}<select value={val('body_type')} onChange={e => set('body_type', e.target.value)} className={SEL}><option value="">Select</option>{optArr(bodyTypeOptions)}</select></div>
            <div>{LBL('Complexion')}<select value={val('complexion')} onChange={e => set('complexion', e.target.value)} className={SEL}><option value="">Select</option>{optArr(complexionOptions)}</select></div>
            <div>{LBL('Blood Group')}<select value={val('blood_group')} onChange={e => set('blood_group', e.target.value)} className={SEL}><option value="">Select</option>{optArr(bloodGroupOptions)}</select></div>
            <div>{LBL('Physical Disability')}<select value={val('physical_disability')} onChange={e => set('physical_disability', e.target.value)} className={SEL}><option value="No">No</option><option value="Yes">Yes</option></select></div>
            {val('physical_disability') === 'Yes' && <div>{LBL('Disability Description')}<input value={val('disability_desc')} onChange={e => set('disability_desc', e.target.value)} className={INP} placeholder="Describe briefly" /></div>}
          </div>
          <div className="border-t border-gray-100 mt-4 pt-4">
            <h5 className="text-xs font-semibold text-gray-700 mb-3">Lifestyle Habits</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>{LBL('Diet')}<select value={val('diet')} onChange={e => set('diet', e.target.value)} className={SEL}><option value="">Select</option>{optArr(dietOptions)}</select></div>
              <div>{LBL('Smoking')}<select value={val('smoking')} onChange={e => set('smoking', e.target.value)} className={SEL}><option value="">Select</option>{optArr(smokingDrinkingOptions)}</select></div>
              <div>{LBL('Drinking')}<select value={val('drinking')} onChange={e => set('drinking', e.target.value)} className={SEL}><option value="">Select</option>{optArr(smokingDrinkingOptions)}</select></div>
            </div>
          </div>
        </div>
        {/* Step 8: Family Details (same as registration step 8) */}
        <div className="border-b border-gray-100 pb-4 mb-4">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5"><UsersIcon size={12} /> Family Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>{LBL('Family Type')}<select value={val('family_type')} onChange={e => set('family_type', e.target.value)} className={SEL}><option value="">Select</option>{optArr(familyTypeOptions)}</select></div>
            <div>{LBL('Family Status')}<select value={val('family_status')} onChange={e => set('family_status', e.target.value)} className={SEL}><option value="">Select</option>{optArr(familyStatusOptions)}</select></div>
            <div>{LBL('Family Values')}<select value={val('family_values')} onChange={e => set('family_values', e.target.value)} className={SEL}><option value="">Select</option>{optArr(familyValuesOptions)}</select></div>
          </div>
          {/* Children Details - Same as Registration Step 8 */}
          {showChildren && (
            <div className="mt-3 p-3 border rounded-lg bg-gray-50 border-gray-200">
              <h5 className="text-xs font-semibold text-gray-700 mb-2">Children Details</h5>
              <div>{LBL('Number of Children')}<input type="number" min="0" value={val('children_count')} onChange={e => { const count = parseInt(e.target.value) || 0; if (count < 0) return; const curChildren = (val('children') || []) as {name: string, gender: string, age: string}[]; const newChildren = Array.from({length: count}).map((_, idx) => curChildren[idx] || {name: '', gender: 'Boy', age: ''}); setMulti({ children_count: e.target.value, children: newChildren }); }} className={INP} /></div>
              {parseInt(val('children_count')) > 0 && (val('children') as {name: string, gender: string, age: string}[])?.map((child: any, index: number) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 border-t pt-3">
                  <div>{LBL(`Child ${index+1} Name`)}<input value={child.name || ''} onChange={e => { const nc = [...(val('children') as any[])]; nc[index] = {...nc[index], name: e.target.value}; set('children', nc); }} className={INP} /></div>
                  <div>{LBL(`Child ${index+1} Gender`)}<select value={child.gender || 'Boy'} onChange={e => { const nc = [...(val('children') as any[])]; nc[index] = {...nc[index], gender: e.target.value}; set('children', nc); }} className={SEL}><option value="Boy">Boy</option><option value="Girl">Girl</option></select></div>
                  <div>{LBL(`Child ${index+1} Age (Years)`)}<input type="number" min="0" value={child.age || ''} onChange={e => { const nc = [...(val('children') as any[])]; nc[index] = {...nc[index], age: e.target.value}; set('children', nc); }} className={INP} /></div>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div>{LBL("Father's Name")}<input value={val('father_name')} onChange={e => set('father_name', e.target.value)} className={INP} /></div>
            <div>{LBL("Father's Occupation")}<select value={val('father_occupation')} onChange={e => set('father_occupation', e.target.value)} className={SEL}><option value="">Select</option>{['Business', 'Service', 'Private Job', 'Government Job', 'Retired', 'Other'].map(v => <option key={v} value={v}>{v}</option>)}</select></div>
            <div>{LBL("Mother's Name")}<input value={val('mother_name')} onChange={e => set('mother_name', e.target.value)} className={INP} /></div>
            <div>{LBL("Mother's Occupation")}<select value={val('mother_occupation')} onChange={e => set('mother_occupation', e.target.value)} className={SEL}><option value="">Select</option>{['Housewife', 'Business', 'Service', 'Private Job', 'Government Job', 'Retired', 'Other'].map(v => <option key={v} value={v}>{v}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div>{LBL('Total Brothers')}<input type="number" min="0" value={val('brothers')} onChange={e => set('brothers', e.target.value)} className={INP} /></div>
            <div>{LBL('Married Brothers')}<input type="number" min="0" value={val('married_brothers')} onChange={e => set('married_brothers', e.target.value)} className={INP} /></div>
            <div>{LBL('Total Sisters')}<input type="number" min="0" value={val('sisters')} onChange={e => set('sisters', e.target.value)} className={INP} /></div>
            <div>{LBL('Married Sisters')}<input type="number" min="0" value={val('married_sisters')} onChange={e => set('married_sisters', e.target.value)} className={INP} /></div>
          </div>
          {/* Mosal Details - Same as Registration Step 8 */}
          <h5 className="text-xs font-semibold text-primary mt-4 border-b pb-1">Mosal (Maternal) Details</h5>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div>{LBL('Mosal Name')}<input value={val('mosal_name')} onChange={e => set('mosal_name', e.target.value)} className={INP} /></div>
            <div>{LBL('Mosal State')}<select value={val('mosal_state')} onChange={e => setMulti({ mosal_state: e.target.value, mosal_city: '' })} className={SEL}><option value="">Select State</option>{mappedStates.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
            <div>{LBL('Mosal City / Taluka')}<select value={val('mosal_city')} onChange={e => set('mosal_city', e.target.value)} className={SEL} disabled={!val('mosal_state')}><option value="">Select City</option>{mappedMosalCities.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
            <div>{LBL('Family Income')}<select value={val('family_income')} onChange={e => set('family_income', e.target.value)} className={SEL}><option value="">Select</option>{optArr(incomeOptions)}</select></div>
            <div className="md:col-span-2">{LBL('Mosal Address')}<input value={val('mosal_address')} onChange={e => set('mosal_address', e.target.value)} className={INP} /></div>
          </div>
        </div>
        {/* About */}
        <div className="border-b border-gray-100 pb-4 mb-4">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5"><Edit3 size={12} /> About</h4>
          <textarea rows={3} value={val('about_me')} onChange={e => set('about_me', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary resize-none" placeholder="Write something about the profile..." />
        </div>
        {/* Step 9: Photo & Documents - All Optional for Admin */}
        <div>
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5"><CheckCircle size={12} /> Photo & Documents</h4>
          {/* Profile Photo */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">Profile Photo <span className="text-gray-400 font-normal border px-1.5 py-0.5 rounded text-[10px] ml-1">Optional</span></p>
            <div className="flex gap-4 items-center">
              <div className="relative w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden cursor-pointer hover:border-primary transition group" onClick={() => profilePhotoRef.current?.click()}>
                {profilePhotoPreview ? <img src={profilePhotoPreview} className="w-full h-full object-cover" alt="Profile" /> : val('profile_photo_url') && !profilePhotoFile ? <img src={val('profile_photo_url')} className="w-full h-full object-cover" alt="Profile" /> : <Camera className="text-gray-400 group-hover:text-primary" size={24} />}
                <input ref={profilePhotoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setProfilePhotoFile(f); setProfilePhotoPreview(URL.createObjectURL(f)); } }} />
              </div>
              <p className="text-[10px] text-gray-500 max-w-[180px]">Click to upload or change profile photo.</p>
            </div>
          </div>
          {/* Aadhaar Card */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">Aadhaar Card Upload <span className="text-gray-400 font-normal border px-1.5 py-0.5 rounded text-[10px] ml-1">Optional</span></p>
            <p className="text-[10px] text-gray-500 mb-2">Upload both sides for verification.</p>
            <div className="grid grid-cols-2 gap-3">
              <div onClick={() => !aadhaarFront && aadhaarFrontRef.current?.click()} className="border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition hover:border-primary hover:bg-primary/5 relative">
                {hasAadhaarFront && !aadhaarFront ? <><CheckCircle className="text-green-500 mx-auto mb-1" size={20} /><span className="text-[10px] text-green-600 font-bold block">Front Side Uploaded</span></> : !aadhaarFront ? <><Upload className="text-gray-400 mx-auto mb-1" size={20} /><span className="text-[10px] font-medium">Add Front Side</span></> : <><FileText className="text-primary mx-auto mb-1" size={20} /><span className="text-[10px] text-green-600 font-bold truncate block">{aadhaarFront.name}</span><button type="button" className="absolute top-1 right-1 text-red-500" onClick={(e) => { e.stopPropagation(); setAadhaarFront(null); }}><X size={14} /></button></>}
                <input ref={aadhaarFrontRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { e.target.files?.[0] && setAadhaarFront(e.target.files[0]); }} />
              </div>
              <div onClick={() => !aadhaarBack && aadhaarBackRef.current?.click()} className="border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition hover:border-primary hover:bg-primary/5 relative">
                {hasAadhaarBack && !aadhaarBack ? <><CheckCircle className="text-green-500 mx-auto mb-1" size={20} /><span className="text-[10px] text-green-600 font-bold block">Back Side Uploaded</span></> : !aadhaarBack ? <><Upload className="text-gray-400 mx-auto mb-1" size={20} /><span className="text-[10px] font-medium">Add Back Side</span></> : <><FileText className="text-primary mx-auto mb-1" size={20} /><span className="text-[10px] text-green-600 font-bold truncate block">{aadhaarBack.name}</span><button type="button" className="absolute top-1 right-1 text-red-500" onClick={(e) => { e.stopPropagation(); setAadhaarBack(null); }}><X size={14} /></button></>}
                <input ref={aadhaarBackRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { e.target.files?.[0] && setAadhaarBack(e.target.files[0]); }} />
              </div>
            </div>
          </div>
          {/* Biodata */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">Biodata Document <span className="text-gray-400 font-normal border px-1.5 py-0.5 rounded text-[10px] ml-1">Optional</span></p>
            <div onClick={() => !biodataFile && biodataFileRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-xl p-3 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition relative">
              {hasBiodata && !biodataFile ? <><CheckCircle className="text-green-500 mx-auto mb-1" size={20} /><span className="text-[10px] text-green-600 font-bold block">Biodata Uploaded</span></> : !biodataFile ? <><Upload className="text-gray-400 mx-auto mb-1" size={20} /><span className="text-[10px] font-medium">Upload PDF/Image Biodata</span></> : <><FileText className="text-primary mx-auto mb-1" size={20} /><span className="text-[10px] text-green-600 font-bold truncate block">{biodataFile.name}</span><button type="button" className="absolute top-1 right-1 text-red-500" onClick={(e) => { e.stopPropagation(); setBiodataFile(null); }}><X size={14} /></button></>}
              <input ref={biodataFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && setBiodataFile(e.target.files[0])} />
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl"><Users className="text-primary" size={24} /></div>
            User Management
          </h1>
          <p className="text-gray-500 text-sm mt-1 ml-11">Manage, filter, search and edit all registered profiles</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-4 py-2 bg-gradient-to-r from-primary/10 to-primary/5 text-primary rounded-xl text-sm font-bold border border-primary/20 shadow-sm">
            {totalCount} Total Users
          </div>
          <Button variant="outline" onClick={handleDownloadTemplate} className="flex items-center gap-2 shadow-sm text-xs">
            <Download size={14} /> Template
          </Button>
          <Button variant="outline" onClick={handleExportUsers} className="flex items-center gap-2 shadow-sm text-xs">
            <Download size={14} /> Export
          </Button>
          <Button variant="outline" onClick={() => importFileRef.current?.click()} className="flex items-center gap-2 shadow-sm text-xs">
            <Upload size={14} /> Import
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 shadow-sm">
            <Plus size={16} /> Add Profile
          </Button>
          <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Primary Filters - always visible */}
        <div className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-gray-50/80 border-b border-gray-100">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
            <select
              value={filters.search_field}
              onChange={(e) => setFilters({ ...filters, search_field: e.target.value })}
              className="px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-primary focus:border-primary font-medium shrink-0"
            >
              <option value="all">🔍 All</option>
              <option value="email">📧 Email</option>
              <option value="phone">📱 Phone</option>
              <option value="profile_id">🆔 User ID</option>
            </select>
            <div className="relative flex-1 sm:w-80">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={`Search by ${filters.search_field === 'all' ? 'name, email, phone, ID' : filters.search_field}...`}
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
          <button
            onClick={() => setShowAllFilters(!showAllFilters)}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${showAllFilters ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            <SlidersHorizontal size={14} /> Filters
          </button>
        </div>

        {/* Advanced Filters */}
        {showAllFilters && (
          <div className="p-4 border-b border-gray-100 bg-white">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Gender</label>
                <select value={filters.gender} onChange={(e) => setFilters({ ...filters, gender: e.target.value })} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-primary">
                  <option value="all">All Genders</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Age Range</label>
                <div className="flex gap-1">
                  <input type="number" placeholder="Min" value={filters.age_min} onChange={(e) => setFilters({ ...filters, age_min: e.target.value })} className="w-1/2 px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" min={18} max={80} />
                  <input type="number" placeholder="Max" value={filters.age_max} onChange={(e) => setFilters({ ...filters, age_max: e.target.value })} className="w-1/2 px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" min={18} max={80} />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">City</label>
                <input type="text" placeholder="Any city" value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Caste</label>
                <input type="text" placeholder="Any caste" value={filters.caste} onChange={(e) => setFilters({ ...filters, caste: e.target.value })} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Premium</label>
                <select value={filters.premium} onChange={(e) => setFilters({ ...filters, premium: e.target.value })} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-primary">
                  <option value="all">All Plans</option>
                  <option value="true">Premium Only</option>
                  <option value="false">Free Only</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Doc Verified</label>
                <select value={filters.doc_verified} onChange={(e) => setFilters({ ...filters, doc_verified: e.target.value })} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-primary">
                  <option value="all">All</option>
                  <option value="true">Verified</option>
                  <option value="false">Unverified</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Email Verified</label>
                <select value={filters.email_verified} onChange={(e) => setFilters({ ...filters, email_verified: e.target.value })} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-primary">
                  <option value="all">All</option>
                  <option value="true">Verified</option>
                  <option value="false">Unverified</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Status</label>
                <select value={filters.active} onChange={(e) => setFilters({ ...filters, active: e.target.value })} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-primary">
                  <option value="all">All Status</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Blocked</label>
                <select value={filters.blocked} onChange={(e) => setFilters({ ...filters, blocked: e.target.value })} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-primary">
                  <option value="all">All</option>
                  <option value="no">Not Blocked</option>
                  <option value="temp">Temp Blocked</option>
                  <option value="permanent">Perm Blocked</option>
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={() => setFilters({ search: '', search_field: 'all', gender: 'all', verified: 'all', active: 'all', premium: 'all', blocked: 'all', caste: '', city: '', age_min: '', age_max: '', email_verified: 'all', doc_verified: 'all' })} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors">
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users List */}
        <div className="p-4">
          {loading ? (
            <div className="py-6">
              <AdminTableSkeleton rows={8} />
            </div>
          ) : users.length === 0 ? (
            <div className="py-20 text-center">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mb-4">
                <Users size={36} className="text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-700 mb-1">No users found</h3>
              <p className="text-gray-400 text-sm">Try adjusting your search or filter criteria.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-4 p-3.5 bg-white rounded-xl border border-gray-100 hover:border-primary/20 hover:shadow-md transition-all group">
                  <div className="relative">
                    <Avatar src={u.profile_photo_url} fallbackName={`${u.first_name} ${u.last_name}`} size="lg" gender={u.gender} />
                    {u.is_premium && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white">
                        <Crown size={10} className="text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link to={`/admin/users/${u.id}`} className="font-bold text-gray-900 hover:text-primary transition-colors truncate">
                        {u.first_name} {u.last_name}
                      </Link>
                      {u.is_verified && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                      {u.is_permanently_blocked && <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-bold">BLOCKED</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-400">
                      <span className="flex items-center gap-0.5 font-mono"><Hash size={9} />{u.profile_id}</span>
                      {u.email && <span className="flex items-center gap-0.5"><Mail size={9} />{u.email}</span>}
                      {u.phone && <span className="flex items-center gap-0.5"><Phone size={9} />{u.phone}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-semibold capitalize">{u.gender}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded font-medium">{getAge(u.date_of_birth)} yrs</span>
                      {u.religion && <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded font-medium">{u.religion}</span>}
                      {u.caste && <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-medium">{u.caste}</span>}
                      {u.city && <span className="text-[10px] px-1.5 py-0.5 bg-teal-50 text-teal-600 rounded font-medium flex items-center gap-0.5"><MapPin size={8} />{u.city}</span>}
                      {u.email_verified && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-semibold">Email ✓</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link
                      to={`/admin/users/${u.id}`}
                      className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[11px] font-bold hover:bg-primary/20 transition-colors flex items-center gap-1"
                    >
                      <Eye size={12} /> View
                    </Link>
                    <button
                      onClick={() => setEditUser({ ...u })}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-bold hover:bg-blue-100 transition-colors flex items-center gap-1"
                    >
                      <Edit3 size={12} /> Edit
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenu(activeMenu === u.id ? null : u.id)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical size={16} className="text-gray-400" />
                      </button>
                      {activeMenu === u.id && (
                        <div className="absolute right-0 top-10 w-52 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                          <button onClick={() => { handleToggleField(u.id, 'is_verified', u.is_verified); }} className="w-full px-4 py-2.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2 font-medium">
                            {u.is_verified ? <ShieldOff size={14} className="text-orange-500" /> : <Shield size={14} className="text-emerald-500" />}
                            {u.is_verified ? 'Unverify User' : 'Verify User'}
                          </button>
                          <button onClick={() => { handleToggleField(u.id, 'is_active', u.is_active); }} className="w-full px-4 py-2.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2 font-medium">
                            {u.is_active ? <UserX size={14} className="text-red-500" /> : <UserCheck size={14} className="text-green-500" />}
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button onClick={() => { handleToggleField(u.id, 'is_premium', u.is_premium); }} className="w-full px-4 py-2.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2 font-medium">
                            {u.is_premium ? <StarOff size={14} className="text-gray-500" /> : <Star size={14} className="text-amber-500" />}
                            {u.is_premium ? 'Remove Premium' : 'Make Premium'}
                          </button>
                          <Link to={`/admin/users/${u.id}`} className="w-full px-4 py-2.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2 font-bold text-primary border-t border-gray-50 block">
                            <ExternalLink size={14} /> Full Details
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 bg-gray-50/80 flex items-center justify-between border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing <span className="font-bold text-gray-900">{(page - 1) * limit + 1}</span>-<span className="font-bold text-gray-900">{Math.min(page * limit, totalCount)}</span> of <span className="font-bold text-gray-900">{totalCount}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)} className="px-2">
                <ChevronLeft size={14} />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) pageNum = i + 1;
                else if (page <= 3) pageNum = i + 1;
                else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = page - 2 + i;
                return (
                  <button key={pageNum} onClick={() => setPage(pageNum)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${page === pageNum ? 'bg-primary text-white shadow-sm' : 'hover:bg-gray-200 text-gray-600'}`}>
                    {pageNum}
                  </button>
                );
              })}
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)} className="px-2">
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-start justify-center min-h-screen pt-4 px-4 pb-20">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !editLoading && setEditUser(null)} />
            <div className="relative bg-white rounded-2xl text-left overflow-hidden shadow-2xl my-6 max-w-3xl w-full border border-gray-200">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Avatar src={editUser.profile_photo_url} fallbackName={`${editUser.first_name} ${editUser.last_name}`} size="md" gender={editUser.gender} />
                  <div className="text-white">
                    <h3 className="text-lg font-bold">Edit Profile</h3>
                    <p className="text-xs opacity-80">{editUser.profile_id}</p>
                  </div>
                </div>
                <button onClick={() => setEditUser(null)} className="text-white/70 hover:text-white p-1" disabled={editLoading}>
                  <X size={22} />
                </button>
              </div>

              {/* Edit Form */}
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {renderProfileFields(editUser, setEditUser)}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
                <Button variant="outline" onClick={() => setEditUser(null)} disabled={editLoading}>Cancel</Button>
                <Button onClick={handleEditSave} loading={editLoading} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
                  <Save size={16} /> Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Profile Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-start justify-center min-h-screen pt-4 px-4 pb-20">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !addingProfile && setShowAddModal(false)} />
            <div className="relative bg-white rounded-2xl text-left overflow-hidden shadow-2xl my-6 max-w-3xl w-full border border-gray-200">
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><Plus size={20} className="text-white" /></div>
                  <div className="text-white">
                    <h3 className="text-lg font-bold">Add New Profile</h3>
                    <p className="text-xs opacity-80">Fill in all registration details</p>
                  </div>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-white/70 hover:text-white p-1" disabled={addingProfile}>
                  <X size={22} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleAddProfile}>
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  {renderProfileFields(newProfile, setNewProfile)}
                </div>

                <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
                  <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} disabled={addingProfile}>Cancel</Button>
                  <Button type="submit" loading={addingProfile} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <Plus size={16} /> Add Profile
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
