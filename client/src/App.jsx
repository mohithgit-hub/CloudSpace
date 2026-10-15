import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import {
  Folder,
  FileText,
  Upload,
  Search,
  Star,
  Trash2,
  HardDrive,
  Plus,
  MoreVertical,
  Download,
  Share2,
  Trash,
  ChevronRight,
  FolderPlus,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  Code,
  File,
  X,
  CheckCircle,
  AlertCircle,
  Menu,
  Sun,
  Moon,
  LogOut,
  Lock,
  Mail,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('signin'); // 'signin' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [view, setView] = useState('all'); // 'all', 'starred', 'trash', category name
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderPath, setFolderPath] = useState([]);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageQuota, setStorageQuota] = useState(16106127360); // 15 GB
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [toast, setToast] = useState(null);

  // Modals & Popups
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchStorageData();
    }
  }, [user, view, currentFolderId, searchQuery]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        showToast('Account created successfully! You can now sign in.', 'success');
        setAuthMode('signin');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showToast('Signed in successfully!', 'success');
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    showToast('Signed out successfully', 'success');
  };

  const fetchStorageData = async () => {
    try {
      setLoading(true);

      // Fetch Folders
      let fQuery = supabase.from('folders').select('*').eq('is_trashed', view === 'trash');
      if (view === 'trash') {
        // already filtered
      } else if (view === 'starred') {
        fQuery = fQuery.eq('is_starred', true);
      } else if (currentFolderId) {
        fQuery = fQuery.eq('parent_id', currentFolderId);
      } else {
        fQuery = fQuery.is('parent_id', null);
      }

      if (searchQuery) {
        fQuery = fQuery.ilike('name', `%${searchQuery}%`);
      }

      const { data: foldersData, error: fErr } = await fQuery;
      if (fErr) throw fErr;

      // Fetch Files
      let fileQuery = supabase.from('files').select('*').eq('is_trashed', view === 'trash');
      if (view === 'trash') {
        // already filtered
      } else if (view === 'starred') {
        fileQuery = fileQuery.eq('is_starred', true);
      } else if (view !== 'all' && !searchQuery) {
        fileQuery = fileQuery.eq('category', view);
      } else if (currentFolderId && view === 'all') {
        fileQuery = fileQuery.eq('folder_id', currentFolderId);
      } else if (view === 'all' && !searchQuery) {
        fileQuery = fileQuery.is('folder_id', null);
      }

      if (searchQuery) {
        fileQuery = fileQuery.ilike('name', `%${searchQuery}%`);
      }

      const { data: filesData, error: fileErr } = await fileQuery;
      if (fileErr) throw fileErr;

      // Calculate storage used
      const { data: allFiles } = await supabase.from('files').select('size').eq('is_trashed', false);
      const totalUsed = allFiles ? allFiles.reduce((acc, f) => acc + (f.size || 0), 0) : 0;

      setFolders(foldersData || []);
      setFiles(filesData || []);
      setStorageUsed(totalUsed);
    } catch (err) {
      console.error('Error fetching storage:', err);
      showToast('Error loading files. Check Supabase connection & schema.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const { error } = await supabase.from('folders').insert([
        {
          name: newFolderName.trim(),
          parent_id: currentFolderId,
          user_id: user.id
        }
      ]);
      if (error) throw error;

      setNewFolderName('');
      setShowNewFolderModal(false);
      showToast('Folder created successfully');
      fetchStorageData();
    } catch (err) {
      console.error('Create folder error:', err);
      showToast(err.message, 'error');
    }
  };

  const getCategory = (mimeType) => {
    if (!mimeType) return 'other';
    if (mimeType.startsWith('image/')) return 'images';
    if (mimeType.startsWith('video/')) return 'videos';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('sheet') || mimeType.includes('text/')) return 'documents';
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed')) return 'archives';
    if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('html') || mimeType.includes('css')) return 'code';
    return 'other';
  };

  const handleFileUpload = async (e) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    const file = uploadedFiles[0];
    const sanitizedName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    // storage path prefixed by user.id so RLS policy (foldername[1] = auth.uid) matches
    const storagePath = `${user.id}/${currentFolderId || 'root'}/${sanitizedName}`;

    try {
      setUploadProgress(10);
      const { error: uploadErr } = await supabase.storage
        .from('cloud-files')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });

      if (uploadErr) throw uploadErr;
      setUploadProgress(70);

      const { data: urlData } = supabase.storage.from('cloud-files').getPublicUrl(storagePath);
      const publicUrl = urlData?.publicUrl || '';
      const category = getCategory(file.type);

      const { error: dbErr } = await supabase.from('files').insert([
        {
          name: file.name,
          original_name: file.name,
          storage_path: storagePath,
          size: file.size,
          mime_type: file.type,
          category,
          folder_id: currentFolderId,
          public_url: publicUrl,
          user_id: user.id
        }
      ]);

      if (dbErr) throw dbErr;

      setUploadProgress(null);
      showToast('File uploaded successfully');
      fetchStorageData();
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadProgress(null);
      showToast('Upload failed: ' + err.message, 'error');
    }
  };

  const toggleStar = async (type, id, currentStatus) => {
    try {
      const table = type === 'folder' ? 'folders' : 'files';
      await supabase.from(table).update({ is_starred: !currentStatus }).eq('id', id);
      fetchStorageData();
    } catch (err) {
      showToast('Failed to update star', 'error');
    }
  };

  const toggleTrash = async (type, id, currentStatus) => {
    try {
      const table = type === 'folder' ? 'folders' : 'files';
      await supabase.from(table).update({ is_trashed: !currentStatus }).eq('id', id);
      fetchStorageData();
      showToast(currentStatus ? 'Restored item' : 'Moved to trash');
    } catch (err) {
      showToast('Action failed', 'error');
    }
  };

  const deletePermanently = async (type, id, storagePath) => {
    if (!confirm('Permanently delete this item?')) return;
    try {
      if (type === 'file' && storagePath) {
        await supabase.storage.from('cloud-files').remove([storagePath]);
      }
      const table = type === 'folder' ? 'folders' : 'files';
      await supabase.from(table).delete().eq('id', id);
      fetchStorageData();
      showToast('Permanently deleted');
    } catch (err) {
      showToast('Deletion failed', 'error');
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const getFileIcon = (category) => {
    switch (category) {
      case 'images': return <ImageIcon className="w-5 h-5 text-emerald-500" />;
      case 'videos': return <Video className="w-5 h-5 text-rose-500" />;
      case 'audio': return <Music className="w-5 h-5 text-amber-500" />;
      case 'archives': return <Archive className="w-5 h-5 text-purple-500" />;
      case 'code': return <Code className="w-5 h-5 text-blue-500" />;
      default: return <FileText className="w-5 h-5 text-indigo-500" />;
    }
  };

  const quotaPercent = Math.min(100, (storageUsed / storageQuota) * 100);

  // If not authenticated, render gorgeous Login/Register screen
  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${darkMode ? 'dark bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`w-full max-w-md p-8 rounded-3xl border shadow-2xl ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <HardDrive className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">CloudSpace</h1>
              <p className="text-xs text-gray-400">Secure Cloud Storage System</p>
            </div>
          </div>

          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-6">
            <button
              onClick={() => setAuthMode('signin')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${authMode === 'signin' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-400'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthMode('signup')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${authMode === 'signup' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-400'}`}
            >
              Register
            </button>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 text-sm rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email Address</label>
              <div className={`flex items-center gap-2 px-3 py-3 rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <Mail className="w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Password</label>
              <div className={`flex items-center gap-2 px-3 py-3 rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <Lock className="w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm w-full"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
            >
              {authLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (authMode === 'signin' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex ${darkMode ? 'dark bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 ${
              toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200' : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200'
            }`}
          >
            {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`w-64 border-r flex flex-col justify-between p-4 ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <div>
          <div className="flex items-center gap-3 px-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none tracking-tight">CloudSpace</h1>
              <span className="text-xs text-gray-400 font-medium">Secure Storage</span>
            </div>
          </div>

          <div className="mb-6 px-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all transform active:scale-95"
            >
              <Upload className="w-4 h-4" />
              Upload File
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <nav className="space-y-1">
            {[
              { id: 'all', label: 'My Files', icon: Folder },
              { id: 'starred', label: 'Starred', icon: Star },
              { id: 'images', label: 'Images', icon: ImageIcon },
              { id: 'documents', label: 'Documents', icon: FileText },
              { id: 'videos', label: 'Videos', icon: Video },
              { id: 'audio', label: 'Audio', icon: Music },
              { id: 'archives', label: 'Archives', icon: Archive },
              { id: 'code', label: 'Code', icon: Code },
              { id: 'trash', label: 'Trash', icon: Trash2 },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setView(item.id);
                    if (item.id === 'all') setCurrentFolderId(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile & Storage quota */}
        <div className="space-y-4">
          <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-gray-800/50 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex justify-between text-xs font-semibold mb-2">
              <span>Storage</span>
              <span className="text-indigo-600 dark:text-indigo-400">{quotaPercent.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden mb-2">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatBytes(storageUsed)} of {formatBytes(storageQuota)} used
            </p>
          </div>

          <div className="flex items-center justify-between px-2 pt-2 border-t border-gray-200 dark:border-gray-800">
            <div className="truncate text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
              {user.email}
            </div>
            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className={`h-16 border-b px-6 flex items-center justify-between gap-4 ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border flex-1 ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-800'}`}>
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search files and folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {view === 'all' && !searchQuery && (
              <button
                onClick={() => setShowNewFolderModal(true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                  darkMode ? 'border-gray-700 hover:bg-gray-800 text-gray-200' : 'border-gray-200 hover:bg-gray-100 text-gray-700'
                }`}
              >
                <FolderPlus className="w-4 h-4 text-indigo-500" />
                New Folder
              </button>
            )}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-xl border transition-colors ${
                darkMode ? 'border-gray-700 hover:bg-gray-800 text-yellow-400' : 'border-gray-200 hover:bg-gray-100 text-gray-600'
              }`}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Breadcrumbs & Title */}
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold capitalize">
              {searchQuery ? `Search Results for "${searchQuery}"` : view === 'all' ? 'My Files' : view}
            </h2>
            {view === 'all' && !searchQuery && (
              <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                <button
                  onClick={() => {
                    setCurrentFolderId(null);
                    setFolderPath([]);
                  }}
                  className="hover:underline"
                >
                  Root
                </button>
                {folderPath.map((folder, idx) => (
                  <React.Fragment key={folder.id}>
                    <ChevronRight className="w-3.5 h-3.5" />
                    <button
                      onClick={() => {
                        setCurrentFolderId(folder.id);
                        setFolderPath(folderPath.slice(0, idx + 1));
                      }}
                      className="hover:underline"
                    >
                      {folder.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upload Progress Overlay */}
        {uploadProgress !== null && (
          <div className="mx-8 mb-4 p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm font-medium mb-1">
                <span className="text-indigo-600 dark:text-indigo-400">Uploading file...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-indigo-200 dark:bg-indigo-900 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Grid / Content View */}
        <div className="flex-1 px-8 pb-8 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : folders.length === 0 && files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Folder className="w-16 h-16 stroke-1 mb-2 opacity-50" />
              <p className="text-sm font-medium">No files or folders found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Folders Section */}
              {folders.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Folders</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {folders.map((folder) => (
                      <div
                        key={folder.id}
                        onDoubleClick={() => {
                          if (view === 'all') {
                            setCurrentFolderId(folder.id);
                            setFolderPath([...folderPath, folder]);
                          }
                        }}
                        className={`group p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          darkMode ? 'bg-gray-900/50 border-gray-800 hover:border-gray-700' : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <Folder className="w-5 h-5 text-indigo-500 fill-indigo-500/20 flex-shrink-0" />
                          <span className="text-sm font-medium truncate">{folder.name}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {view !== 'trash' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStar('folder', folder.id, folder.is_starred);
                              }}
                              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-amber-400"
                            >
                              <Star className={`w-4 h-4 ${folder.is_starred ? 'fill-amber-400 text-amber-400' : ''}`} />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (view === 'trash') deletePermanently('folder', folder.id);
                              else toggleTrash('folder', folder.id, folder.is_trashed);
                            }}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-rose-500"
                          >
                            {view === 'trash' ? <Trash className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files Section */}
              {files.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Files</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        onClick={() => setPreviewFile(file)}
                        className={`group p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                          darkMode ? 'bg-gray-900/50 border-gray-800 hover:border-gray-700' : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800">
                            {getFileIcon(file.category)}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            {view !== 'trash' && (
                              <>
                                <a
                                  href={file.public_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  download
                                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-indigo-500"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                                <button
                                  onClick={() => toggleStar('file', file.id, file.is_starred)}
                                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-amber-400"
                                >
                                  <Star className={`w-4 h-4 ${file.is_starred ? 'fill-amber-400 text-amber-400' : ''}`} />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                if (view === 'trash') deletePermanently('file', file.id, file.storage_path);
                                else toggleTrash('file', file.id, file.is_trashed);
                              }}
                              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-rose-500"
                            >
                              {view === 'trash' ? <Trash className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium truncate mb-1">{file.name}</p>
                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <span>{formatBytes(file.size)}</span>
                            <span className="uppercase">{file.category}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* New Folder Modal */}
      <AnimatePresence>
        {showNewFolderModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`w-full max-w-md p-6 rounded-3xl border shadow-xl ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Create New Folder</h3>
                <button
                  onClick={() => setShowNewFolderModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateFolder}>
                <input
                  type="text"
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  autoFocus
                  className={`w-full px-4 py-3 rounded-xl border text-sm mb-4 outline-none ${
                    darkMode ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                />
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNewFolderModal(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
                  >
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* File Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-2xl p-6 rounded-3xl border shadow-2xl flex flex-col max-h-[85vh] ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 truncate">
                  {getFileIcon(previewFile.category)}
                  <h3 className="text-lg font-bold truncate">{previewFile.name}</h3>
                </div>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-950 rounded-2xl overflow-hidden my-2 min-h-[300px]">
                {previewFile.category === 'images' ? (
                  <img src={previewFile.public_url} alt={previewFile.name} className="max-h-full max-w-full object-contain" />
                ) : previewFile.category === 'videos' ? (
                  <video src={previewFile.public_url} controls className="max-h-full max-w-full" />
                ) : (
                  <div className="text-center p-6 text-gray-400">
                    <FileText className="w-16 h-16 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">Preview not available for this file type</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="text-xs text-gray-400">
                  <span>Size: {formatBytes(previewFile.size)}</span> • <span className="uppercase">{previewFile.category}</span>
                </div>
                <div className="flex gap-3">
                  <a
                    href={previewFile.public_url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
