-- Script de Limpeza do Banco de Dados para a RiverTech
-- Este script irá limpar os dados transacionais (pedidos, produtos, configurações, etc)
-- E irá remover todos os usuários e empresas, EXCETO o usuário do super admin master.
-- 
-- ATENÇÃO: EXECUTE COM CUIDADO NO SQL EDITOR DO SUPABASE.

BEGIN;

-- 1. Limpar Agendamentos e Módulo SaaS Barbearia/Serviços
DELETE FROM public.agendamentos;
DELETE FROM public.lista_espera;
DELETE FROM public.profissional_servicos;
DELETE FROM public.horarios_funcionamento;
DELETE FROM public.mensagens_templates;
DELETE FROM public.servicos;
DELETE FROM public.profissionais;

-- 2. Limpar pedidos e itens do pedido
DELETE FROM public.order_items;
DELETE FROM public.orders;

-- 3. Limpar estoque
DELETE FROM public.stock_movements;
DELETE FROM public.stock_reasons;

-- 4. Limpar produtos e categorias
DELETE FROM public.products;
DELETE FROM public.categories;

-- 5. Limpar configurações da loja, cupons, fretes e atendentes
DELETE FROM public.store_settings;
DELETE FROM public.coupons;
DELETE FROM public.shipping_zones;
DELETE FROM public.atendentes;

-- 6. Limpar usuários comuns do sistema
-- Apenas super_admins permanecerão.
DELETE FROM public.admin_users 
WHERE user_id NOT IN (SELECT id FROM public.super_admins);

DELETE FROM public.usuarios 
WHERE id NOT IN (SELECT id FROM public.super_admins);

-- 7. Limpar auth.users (remover quem não é super admin)
DELETE FROM auth.users 
WHERE id NOT IN (SELECT id FROM public.super_admins);

-- 8. Limpar empresas (Tenant)
DELETE FROM public.empresas;

COMMIT;
