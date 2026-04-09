// src/hooks/useTelegram.js
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

export const useTelegram = () => {
  const { user } = useAuth();               // contiene id, role, etc.
  const [linked, setLinked] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const backendBase = process.env.REACT_APP_BACKEND_URL; // sin barra final, ej: http://
  
  const fetchStatus = useCallback(async () => {
    if (!user) {
      setLinked(false);
      setEnabled(false);
      setLoading(false);
      return;
    }
    try {
      // No enviamos Authorization → la cookie via withCredentials
      const { data } = await api.get(
        `${backendBase}/users/${user.id}/telegram`
      );
      setLinked(data.linked);
      setEnabled(!!data.enabled);
    } catch (err) {
      console.error('Telegram status fetch error', err);
      setLinked(false);
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, [user, backendBase]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const registerTelegram = async () => {
    if (!user) return;
    try {
      const { data } = await api.get(
        `${backendBase}/users/${user.id}/telegram-link`
      );
      const { link } = data;
      window.open(link, '_blank');
    } catch (err) {
      console.error('Error getting telegram link', err);
      alert('No se pudo generar el enlace de Telegram.');
    }
  };

  const toggleEnabled = async (newValue) => {
    if (!user) return;
    try {
      await api.patch(
        `${backendBase}/users/${user.id}/telegram`,
        { enabled: newValue }
      );
      setEnabled(newValue);
    } catch (err) {
      console.error('Error toggling telegram notifications', err);
    }
  };

  return {
    linked,
    enabled,
    loading,
    registerTelegram,
    toggleEnabled,
    refresh: fetchStatus,
  };
};
