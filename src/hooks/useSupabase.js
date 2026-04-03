import { useState, useCallback } from 'react';
import supabase from '../lib/supabase';

export function useSupabase() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async (table, options = {}) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from(table).select(options.select || '*');

      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      if (options.order) {
        const { column, ascending = false } = options.order;
        query = query.order(column, { ascending });
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error: err } = await query;

      if (err) throw err;
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Error fetching data:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOne = useCallback(async (table, id, options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(table)
        .select(options.select || '*')
        .eq('id', id)
        .single();

      if (err) throw err;
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Error fetching data:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (table, data) => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase
        .from(table)
        .insert([data])
        .select()
        .single();

      if (err) throw err;
      return result;
    } catch (err) {
      setError(err.message);
      console.error('Error creating data:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (table, id, data) => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (err) throw err;
      return result;
    } catch (err) {
      setError(err.message);
      console.error('Error updating data:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const remove = useCallback(async (table, id) => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (err) throw err;
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Error deleting data:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    fetchAll,
    fetchOne,
    create,
    update,
    remove,
  };
}
