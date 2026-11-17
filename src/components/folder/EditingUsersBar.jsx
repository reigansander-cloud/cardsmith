import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useEditingUsers } from '@/hooks/useEditingUsers';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

// Shows a clickable chip for each other user currently editing something in
// Clans. Clicking navigates to the folder (and entry, when applicable) that
// user is editing.
export default function EditingUsersBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const editors = useEditingUsers();
  const [folderNames, setFolderNames] = useState({});

  useEffect(() => {
    base44.entities.Folder.list('-created_date', 200).then((fl) => {
      const m = {};
      (fl || []).forEach((f) => { m[f.id] = f.name; });
      setFolderNames(m);
    }).catch(() => {});
    const unsub = base44.entities.Folder.subscribe((event) => {
      const d = event.data;
      if (!d) return;
      setFolderNames((prev) => ({ ...prev, [event.id]: d.name }));
    });
    return unsub;
  }, []);

  // Entry supertype is denormalized onto the EditLock record (supertype field),
  // so we can render the chip label directly — no per-entry fetch needed.

  const others = editors.filter((e) => e.userId !== user?.id);
  if (others.length === 0) return null;

  const handleClick = (e) => {
    if (e.itemType === 'rules') {
      navigate(e.folderId === '__global__' ? '/clans/rules' : `/folder/${e.folderId}/rules`);
    } else if (e.itemType === 'entry') {
      if (e.context === 'review') {
        navigate(`/clans/review?entry=${e.itemId}`);
      } else {
        navigate(`/folder/${e.folderId}?entry=${e.itemId}`);
      }
    } else {
      navigate(`/folder/${e.folderId}`);
    }
  };

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
      {others.map((e) => {
        const folderName = e.folderId === '__global__' ? 'Clans' : (folderNames[e.folderId] || 'folder');
        let subLabel = folderName;
        if (e.itemType === 'rules') {
          subLabel = `${folderName} · Rules`;
        } else if (e.itemType === 'entry') {
          subLabel = e.context === 'review'
            ? `${folderName} · Review`
            : (e.supertype ? `${folderName} · ${cap(e.supertype)}` : folderName);
        }
        return (
          <button
            key={e.lockId}
            onClick={() => handleClick(e)}
            className="flex items-center gap-1.5 pl-2 pr-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors flex-shrink-0"
            title={`Jump to ${e.userName}'s edit in ${subLabel}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
            <span className="flex flex-col items-start leading-tight">
              <span className="text-xs font-medium whitespace-nowrap">{e.userName}</span>
              <span className="text-[10px] text-primary/70 whitespace-nowrap">{subLabel}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}