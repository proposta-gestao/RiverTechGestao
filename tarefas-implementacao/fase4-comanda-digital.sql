-- =============================================
-- FASE 4: COMANDA DIGITAL — Scripts SQL
-- Referência: fase4-comanda-digital - plano.md
-- =============================================

-- RPC para incrementar o total da comanda de forma atômica
-- Evita race conditions em pedidos simultâneos
CREATE OR REPLACE FUNCTION incrementar_total_comanda(_comanda_id UUID, _valor NUMERIC)
RETURNS void AS $$
BEGIN
    UPDATE comandas
    SET total_acumulado = total_acumulado + _valor
    WHERE id = _comanda_id AND status = 'aberta';
END;
$$ LANGUAGE plpgsql;
