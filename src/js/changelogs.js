/**
 * PZHub - Changelogs Management Module
 */

import { supabase, isConfigured } from './supabaseClient.js';

const DEMO_CHANGELOGS = {
  "viccs-tactical-b42": [
    {
      id: "ch-1",
      modpack_id: "viccs-tactical-b42",
      version: "1.4.0",
      title: "Integração com Radar Isométrico B42 & Novos Veículos",
      notes: "- Adicionado transmissor nativo para o Radar PZHub v2.0.\n- Inclusos 40 veículos militares clássicos de 1993.\n- Otimização de colisão e balanceamento de armas balísticas.",
      created_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: "ch-2",
      modpack_id: "viccs-tactical-b42",
      version: "1.0.0",
      title: "Lançamento Inicial da Operação Tática",
      notes: "- Criação do pacote básico de fardas e coletes táticos.\n- Suporte inicial para servidores cooperativos Build 42.",
      created_at: new Date(Date.now() - 86400000 * 14).toISOString()
    }
  ]
};

export async function fetchModpackChangelogs(modpackId) {
  if (isConfigured) {
    try {
      const { data, error } = await supabase
        .from('modpack_changelogs')
        .select('*')
        .eq('modpack_id', modpackId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) return data;
    } catch (e) {
      console.warn('Erro ao buscar changelogs na nuvem:', e);
    }
  }

  const localSaved = localStorage.getItem(`PZHUB_CHANGELOGS_${modpackId}`);
  if (localSaved) {
    try { return JSON.parse(localSaved); } catch(e) {}
  }

  return DEMO_CHANGELOGS[modpackId] || [
    {
      id: "ch-init",
      modpack_id: modpackId,
      version: "1.0.0",
      title: "Publicação Oficial da Versão Inicial",
      notes: "Primeiro lançamento público do pacote no catálogo comunitário do PZHub.",
      created_at: new Date().toISOString()
    }
  ];
}

export async function createChangelog(modpackId, version, title, notes) {
  const newEntry = {
    id: `ch-${Date.now()}`,
    modpack_id: modpackId,
    version,
    title,
    notes,
    created_at: new Date().toISOString()
  };

  if (isConfigured) {
    try {
      const { data, error } = await supabase
        .from('modpack_changelogs')
        .insert([{ modpack_id: modpackId, version, title, notes }])
        .select();

      if (!error && data && data[0]) {
        await syncLatestModpackVersion(modpackId);
        return data[0];
      }
    } catch (e) {
      console.warn('Erro ao salvar changelog no Supabase:', e);
    }
  }

  // Fallback LocalStorage
  const current = await fetchModpackChangelogs(modpackId);
  const updated = [newEntry, ...current];
  localStorage.setItem(`PZHUB_CHANGELOGS_${modpackId}`, JSON.stringify(updated));
  return newEntry;
}

export async function updateChangelog(id, version, title, notes, modpackId) {
  let updatedEntry = null;

  if (isConfigured) {
    try {
      const { data, error } = await supabase
        .from('modpack_changelogs')
        .update({ version, title, notes })
        .eq('id', id)
        .select();

      if (!error && data && data[0]) {
        updatedEntry = data[0];
        await syncLatestModpackVersion(modpackId);
      }
    } catch (e) {
      console.warn('Erro ao atualizar changelog no Supabase:', e);
    }
  }

  if (!updatedEntry) {
    updatedEntry = {
      id,
      modpack_id: modpackId,
      version,
      title,
      notes,
      updated_at: new Date().toISOString()
    };
  }

  // Atualiza LocalStorage
  const current = await fetchModpackChangelogs(modpackId);
  const updatedList = current.map(c => c.id === id ? { ...c, ...updatedEntry } : c);
  localStorage.setItem(`PZHUB_CHANGELOGS_${modpackId}`, JSON.stringify(updatedList));
  return updatedEntry;
}

export async function deleteChangelog(id, modpackId) {
  if (isConfigured) {
    try {
      const { error } = await supabase
        .from('modpack_changelogs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await syncLatestModpackVersion(modpackId);
    } catch (e) {
      console.warn('Erro ao deletar changelog no Supabase:', e);
    }
  }

  // Atualiza LocalStorage
  const current = await fetchModpackChangelogs(modpackId);
  const remaining = current.filter(c => c.id !== id);
  localStorage.setItem(`PZHUB_CHANGELOGS_${modpackId}`, JSON.stringify(remaining));
  return remaining;
}

export async function syncLatestModpackVersion(modpackId) {
  try {
    const changelogs = await fetchModpackChangelogs(modpackId);
    if (changelogs && changelogs.length > 0) {
      const latestVersion = changelogs[0].version;
      if (isConfigured) {
        await supabase.from('modpacks').update({ version: latestVersion }).eq('id', modpackId);
      }
      return latestVersion;
    }
  } catch (e) {
    console.warn('Erro ao sincronizar versão do modpack:', e);
  }
  return null;
}

