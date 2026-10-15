const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const mime = require('mime-types');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const bucketName = process.env.SUPABASE_BUCKET || 'cloud-files';

const supabase = createClient(supabaseUrl, supabaseKey);

const upload = multer({ storage: multer.memoryStorage() });

// Helper to determine file category
function getCategory(mimeType) {
  if (!mimeType) return 'other';
  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType.startsWith('video/')) return 'videos';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('sheet') ||
    mimeType.includes('presentation') ||
    mimeType.includes('text/')
  )
    return 'documents';
  if (
    mimeType.includes('zip') ||
    mimeType.includes('tar') ||
    mimeType.includes('compressed') ||
    mimeType.includes('rar')
  )
    return 'archives';
  if (
    mimeType.includes('javascript') ||
    mimeType.includes('json') ||
    mimeType.includes('html') ||
    mimeType.includes('css')
  )
    return 'code';
  return 'other';
}

// Routes
// 1. Get Folders & Files
app.get('/api/storage', async (req, res) => {
  try {
    const { folderId, search, category, trash, starred } = req.query;

    let foldersQuery = supabase.from('folders').select('*');
    let filesQuery = supabase.from('files').select('*');

    if (trash === 'true') {
      foldersQuery = foldersQuery.eq('is_trashed', true);
      filesQuery = filesQuery.eq('is_trashed', true);
    } else {
      foldersQuery = foldersQuery.eq('is_trashed', false);
      filesQuery = filesQuery.eq('is_trashed', false);

      if (starred === 'true') {
        foldersQuery = foldersQuery.eq('is_starred', true);
        filesQuery = filesQuery.eq('is_starred', true);
      } else if (folderId && folderId !== 'null' && folderId !== 'undefined') {
        foldersQuery = foldersQuery.eq('parent_id', folderId);
        filesQuery = filesQuery.eq('folder_id', folderId);
      } else {
        foldersQuery = foldersQuery.is('parent_id', null);
        filesQuery = filesQuery.is('folder_id', null);
      }
    }

    if (search) {
      foldersQuery = foldersQuery.ilike('name', `%${search}%`);
      filesQuery = filesQuery.ilike('name', `%${search}%`);
    }

    if (category && category !== 'all' && !trash && !starred) {
      filesQuery = filesQuery.eq('category', category);
    }

    const [foldersRes, filesRes] = await Promise.all([foldersQuery, filesQuery]);

    if (foldersRes.error) throw foldersRes.error;
    if (filesRes.error) throw filesRes.error;

    // Calculate total storage used
    const { data: allFiles, error: usageErr } = await supabase
      .from('files')
      .select('size')
      .eq('is_trashed', false);

    const totalUsed = allFiles ? allFiles.reduce((acc, f) => acc + (f.size || 0), 0) : 0;

    res.json({
      folders: foldersRes.data || [],
      files: filesRes.data || [],
      storageUsed: totalUsed,
      storageQuota: parseInt(process.env.STORAGE_QUOTA_BYTES || '16106127360')
    });
  } catch (err) {
    console.error('Error fetching storage:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Create Folder
app.post('/api/folders', async (req, res) => {
  try {
    const { name, parent_id, color } = req.body;
    const { data, error } = await supabase
      .from('folders')
      .insert([{ name, parent_id: parent_id || null, color: color || '#3b82f6' }])
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Upload File
app.post('/api/files/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { folder_id } = req.body;
    const file = req.file;
    const originalName = file.originalname;
    const sanitizedName = `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storagePath = folder_id ? `${folder_id}/${sanitizedName}` : `root/${sanitizedName}`;

    // Upload to Supabase Storage
    const { data: storageData, error: storageError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (storageError) throw storageError;

    // Get Public URL
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData?.publicUrl || '';
    const category = getCategory(file.mimetype);

    // Save record in files table
    const { data: fileRecord, error: dbError } = await supabase
      .from('files')
      .insert([
        {
          name: originalName,
          original_name: originalName,
          storage_path: storagePath,
          size: file.size,
          mime_type: file.mimetype,
          category,
          folder_id: folder_id && folder_id !== 'null' ? folder_id : null,
          public_url: publicUrl
        }
      ])
      .select()
      .single();

    if (dbError) throw dbError;

    res.json(fileRecord);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Toggle Starred
app.patch('/api/:type/:id/star', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { is_starred } = req.body;
    const table = type === 'folder' ? 'folders' : 'files';

    const { data, error } = await supabase
      .from(table)
      .update({ is_starred, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Toggle Trash
app.patch('/api/:type/:id/trash', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { is_trashed } = req.body;
    const table = type === 'folder' ? 'folders' : 'files';

    const { data, error } = await supabase
      .from(table)
      .update({ is_trashed, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Delete Permanently
app.delete('/api/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;

    if (type === 'file') {
      // Get file storage path first
      const { data: fileRec } = await supabase.from('files').select('storage_path').eq('id', id).single();
      if (fileRec && fileRec.storage_path) {
        await supabase.storage.from(bucketName).remove([fileRec.storage_path]);
      }
      const { error } = await supabase.from('files').delete().eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('folders').delete().eq('id', id);
      if (error) throw error;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Cloud Storage server running on port ${port}`);
});
