-- ================================================================
-- TABLA: configuracion_vacaciones
-- Política de vacaciones de la empresa (días/año, tipo, semana)
-- ================================================================

CREATE TABLE IF NOT EXISTS configuracion_vacaciones (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id    UUID UNIQUE NOT NULL,
  dias_anuales  INTEGER NOT NULL DEFAULT 22,
  tipo_dias     TEXT    NOT NULL DEFAULT 'laborales',  -- 'laborales' | 'naturales'
  dias_laborales TEXT   NOT NULL DEFAULT '1,2,3,4,5', -- 1=Lun … 7=Dom, coma-separado
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE configuracion_vacaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY empresa_config_vac ON configuracion_vacaciones FOR ALL
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

-- Verificar que se creó bien
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'configuracion_vacaciones'
ORDER BY ordinal_position;
