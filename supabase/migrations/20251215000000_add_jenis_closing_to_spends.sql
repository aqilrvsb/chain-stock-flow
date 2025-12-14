-- Add jenis_closing column to spends table
ALTER TABLE public.spends ADD COLUMN IF NOT EXISTS jenis_closing text;
