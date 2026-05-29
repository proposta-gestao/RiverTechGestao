-- Migration: Adicionar configuraÃ§Ãµes de WhatsApp na store_settings
-- Permite que cada empresa configure nÃºmero, mensagem e quais tipos de retirada
-- acionam o redirecionamento ao WhatsApp.

ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS whatsapp_numero TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS whatsapp_msg_template TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS whatsapp_ativo_mesa BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_ativo_retirada BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_ativo_entrega BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.store_settings.whatsapp_numero IS 'NÃºmero do WhatsApp com DDI. Ex: 5531999999999';
COMMENT ON COLUMN public.store_settings.whatsapp_msg_template IS 'Template da mensagem com placeholders: {{cliente_nome}}, {{cliente_telefone}}, {{tipo_entrega}}, {{itens}}, {{subtotal}}, {{desconto}}, {{frete}}, {{total}}, {{endereco}}, {{pagamento}}';
COMMENT ON COLUMN public.store_settings.whatsapp_ativo_mesa IS 'Envia WhatsApp quando tipo de retirada for Mesa';
COMMENT ON COLUMN public.store_settings.whatsapp_ativo_retirada IS 'Envia WhatsApp quando tipo de retirada for Retirada no local';
COMMENT ON COLUMN public.store_settings.whatsapp_ativo_entrega IS 'Envia WhatsApp quando tipo de retirada for Entrega';
