-- ================================================================
-- PASO 1: Ver qué políticas existen actualmente
-- ================================================================
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('vacaciones', 'configuracion_vacaciones', 'trabajadores', 'devoluciones')
ORDER BY tablename, cmd;

-- ================================================================
-- PASO 2: Arreglar RLS de la tabla VACACIONES
-- (mismo problema que tenía trabajadores: with_check mal definido)
-- ================================================================
DROP POLICY IF EXISTS empresa_vacaciones ON vacaciones;

CREATE POLICY empresa_vacaciones ON vacaciones FOR ALL
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
-- PASO 3: Arreglar RLS de CONFIGURACION_VACACIONES (tabla nueva)
-- ================================================================
DROP POLICY IF EXISTS empresa_config_vac ON configuracion_vacaciones;

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

-- ================================================================
-- PASO 4: Arreglar RLS de DEVOLUCIONES
-- ================================================================
DROP POLICY IF EXISTS empresa_devoluciones ON devoluciones;

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
-- PASO 5: Verificar que todas las políticas quedaron bien
-- ================================================================
SELECT tablename, policyname, cmd, with_check IS NOT NULL AS tiene_with_check
FROM pg_policies
WHERE tablename IN ('vacaciones', 'configuracion_vacaciones', 'devoluciones')
ORDER BY tablename;
