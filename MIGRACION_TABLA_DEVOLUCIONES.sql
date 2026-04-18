-- ================================================================
-- CREAR TABLA DEVOLUCIONES
-- ================================================================
CREATE TABLE IF NOT EXISTS devoluciones (
  id             UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id     UUID         NOT NULL,
  pedido_id      UUID,
  cliente        TEXT,
  matricula      TEXT,
  vehiculo       TEXT,
  pieza_ref      TEXT,
  pieza_desc     TEXT,
  pieza_empresa  TEXT,
  pieza_obs      TEXT,
  created_at     TIMESTAMPTZ  DEFAULT NOW()
);

-- ================================================================
-- ACTIVAR RLS
-- ================================================================
ALTER TABLE devoluciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY empresa_devoluciones ON devoluciones FOR ALL
USING (
  empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas WHERE user_id = auth.uid()
  )
);

-- ================================================================
-- VERIFICAR
-- ================================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'devoluciones'
ORDER BY ordinal_position;
