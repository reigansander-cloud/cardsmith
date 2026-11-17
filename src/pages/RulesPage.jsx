import React from 'react';
import { useParams } from 'react-router-dom';
import RulesEditor from '@/components/folder/RulesEditor';

// Rules page. Used for both the clans-wide rules (no :id) and a per-folder
// rules tab (/folder/:id/rules).
export default function RulesPage() {
  const { id } = useParams();
  const folderId = id || '__global__';
  const backTo = id ? `/folder/${id}` : '/clans';
  return <RulesEditor folderId={folderId} backTo={backTo} />;
}