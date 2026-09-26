#Requires -Version 5.1
<#
.SYNOPSIS
    Analiza la calidad del codigo de Synapse con SonarQube Community
    Build corriendo en Docker, y exporta las metricas a CSV/JSON.

.DESCRIPTION
    Flujo completo en un comando:
      1. Levanta SonarQube CE en el proyecto de Docker "synapse-sonar"
         (volumenes propios: no toca los puertos 8080/5000/3307 de dev,
         ni su base de datos, ni el stack de OWASP ZAP).
      2. Espera a que /api/system/status responda UP (arranque en
         frio: 2-3 minutos la primera vez).
      3. Genera un token de API para el usuario admin y lanza el
         SonarScanner CLI sobre el arbol del repositorio.
      4. Descarga del Web API las metricas y los issues de la ultima
         analisis y los deja en quality\sonar\reports.
      5. Imprime un resumen y las URLs del dashboard.

    Por defecto el servidor se deja arriba al terminar, para que
    puedas recorrer los issues en el navegador. Usa -Stop para
    bajarlo (los volumenes persisten, asi que el historial de
    metricas no se pierde).

    Analiza: backend/src, backend/scripts, frontend/src y
    backend/tests. Quedan fuera a proposito:
      - Los .env (contienen el JWT_SECRET y la contrasena de MySQL
        reales: subirlos al servidor los dejaria visibles en el codigo
        fuente del dashboard).
      - frontend/dist y backend/coverage (salida generada).
      - database/synapse.sql: SonarQube Community Build no analiza
        SQL (solo T-SQL y PL/SQL, ambos fuera de la edicion gratis).
      - frontend/src en la metrica de cobertura: no hay tests ni
        framework de testing en el frontend, de modo que contarlo
        como 0% cubierto solo distorsionaria el dato.
      - La cobertura del backend sale de backend\coverage\lcov.info,
        que jest.config.js restringe con collectCoverageFrom a 6
        archivos (los del modulo de autenticacion). El resto del
        backend no aparece en ese informe, asi que SonarQube los
        cuenta como 0% cubiertos: el 24.5% que sale es la cobertura
        real del backend, no solo la de los 6 archivos testeados. El
        gate del 80% de Jest sigue en verde porque solo se aplica a
        esos 6 archivos.

.PARAMETER Fresh
    Destruye el stack y los volumenes antes de empezar. Con esto
    el historial de metricas se reinicia y el analisis se hace
    desde cero. Util si cambiaste el nombre o la clave del proyecto.

.PARAMETER Stop
    Baja el servidor al terminar en vez de dejarlo disponible.
    Los volumenes no se borran: "down -v" es lo que los destruye.

.PARAMETER SkipScan
    No lanza el escaner: solo reexporta las metricas de la ultima
    analisis ya completada en el servidor.

.PARAMETER Token
    Token de API a usar. Si se omite, se genera uno nuevo para el
    usuario admin en cada ejecucion.

.PARAMETER ReportsOnly
    No lanza nada: solo lista los reportes que ya existen.

.EXAMPLE
    .\quality\sonar\run-sonar.ps1
    Levanta SonarQube, escanea el proyecto y exporta las metricas.

.EXAMPLE
    .\quality\sonar\run-sonar.ps1 -Fresh
    analysis desde cero, sin historial previo.

.EXAMPLE
    .\quality\sonar\run-sonar.ps1 -SkipScan
    Reexporta metricas e issues de la ultima analisis.

.NOTES
    Requisito: Docker Desktop con Docker Compose v2.20 o superior.

    Credenciales por defecto del dashboard: admin / admin.
    Cambiarlas es opcional y no afecta al analisis, pero entonces
    habria que pasar el token a mano con -Token.
#>
[CmdletBinding()]
param(
    [switch]$Fresh,
    [switch]$Stop,
    [switch]$SkipScan,
    [switch]$ReportsOnly,
    [string]$Token = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# --- Rutas -------------------------------------------------------------------
$Root        = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ReportDir   = Join-Path $PSScriptRoot 'reports'
$ComposeFile = Join-Path $Root 'docker-compose.sonar.yml'
$Project     = 'synapse-sonar'
$SonarUrl    = 'http://localhost:9000'
$ProjectKey  = 'synapse'

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

$ComposeArgs = @('compose', '-p', $Project, '-f', $ComposeFile)

# Claves de metrica que se piden a /api/measures/component. Las claves
# que la version instalada ya no conozca se omiten en silencio, asi
# que esta lista puede seguir los cambios de version entre Community
# Builds sin romper la exportacion.
$MetricKeys = @(
    'software_quality_maintainability_rating',
    'software_quality_maintainability_debt_ratio',
    'software_quality_maintainability_issues',
    'software_quality_reliability_rating',
    'software_quality_security_rating',
    'sqale_index',
    'sqale_rating',
    'code_smells',
    'bugs',
    'vulnerabilities',
    'security_hotspots',
    'security_review_rating',
    'reliability_rating',
    'security_rating',
    'duplicated_lines_density',
    'duplicated_blocks',
    'ncloc',
    'lines_to_cover',
    'coverage',
    'complexity',
    'cognitive_complexity',
    'alert_status'
)

# Etiquetas en espanol para el CSV y el resumen.
$MetricLabels = @{
    'software_quality_maintainability_rating'      = 'Rating mantenibilidad (Clean Code)'
    'software_quality_maintainability_debt_ratio'  = 'Deuda tecnica ratio (%)'
    'software_quality_maintainability_issues'      = 'Deuda tecnica en issues'
    'software_quality_reliability_rating'           = 'Rating fiabilidad (Clean Code)'
    'software_quality_security_rating'              = 'Rating seguridad (Clean Code)'
    'sqale_index'                                  = 'Deuda tecnica (minutos)'
    'sqale_rating'                                 = 'Rating deuda tecnica (A-E)'
    'code_smells'                                  = 'Code smells'
    'bugs'                                         = 'Bugs'
    'vulnerabilities'                              = 'Vulnerabilidades'
    'security_hotspots'                            = 'Hotspots de seguridad'
    'security_review_rating'                       = 'Revision de seguridad'
    'reliability_rating'                            = 'Rating fiabilidad'
    'security_rating'                              = 'Rating seguridad'
    'duplicated_lines_density'                     = 'Lineas duplicadas (%)'
    'duplicated_blocks'                            = 'Bloques duplicados'
    'ncloc'                                        = 'Lineas de codigo (ncloc)'
    'lines_to_cover'                               = 'Lineas susceptibles de test'
    'coverage'                                     = 'Cobertura (%)'
    'complexity'                                   = 'Complejidad ciclomatica'
    'cognitive_complexity'                         = 'Complejidad cognitiva'
    'alert_status'                                 = 'Quality Gate'
}

# --- Salida ------------------------------------------------------------------
function Write-Step  { param([string]$Text) Write-Host "`n==> $Text" -ForegroundColor Cyan }
function Write-Ok    { param([string]$Text) Write-Host "    $Text" -ForegroundColor Green }
function Write-Info  { param([string]$Text) Write-Host "    $Text" -ForegroundColor Gray }
function Write-Fail  { param([string]$Text) Write-Host "    $Text" -ForegroundColor Red }

# Devuelve el valor de una propiedad si existe, o $Default. Necesario
# porque Set-StrictMode -Version Latest aborta al leer una propiedad
# inexistente, y la Web API no devuelve siempre los mismos campos.
function Get-Prop {
    param($InputObject, [string]$Name, $Default = $null)
    if ($null -eq $InputObject) { return $Default }
    if ($InputObject.PSObject.Properties.Name -contains $Name) {
        $value = $InputObject.$Name
        if ($null -ne $value) { return $value }
    }
    return $Default
}

# Ejecuta docker compose mostrando la salida y devuelve el codigo de
# salida. docker escribe parte de su salida normal por stderr y, con
# ErrorActionPreference = Stop, PowerShell 5.1 lo convertiria en un
# error que abortaria el script: aqui la preferencia baja a Continue
# y el stderr se redirige a la salida.
function Invoke-Compose {
    param(
        [Parameter(Mandatory)][string[]]$DockerArgs,
        [Parameter(Mandatory)][string]$What,
        [switch]$AllowFailure
    )
    $ErrorActionPreference = 'Continue'
    Write-Step $What
    & docker @DockerArgs 2>&1 | ForEach-Object {
        if ($_ -is [System.Management.Automation.ErrorRecord]) { Write-Host $_.Exception.Message }
        else { Write-Host "$_" }
    }
    $code = $LASTEXITCODE
    if ($code -ne 0 -and -not $AllowFailure) {
        throw "$What fallo (docker compose exit $code)."
    }
    return $code
}

# Igual, pero capturando stdout sin escribirlo en pantalla.
function Get-ComposeOutput {
    param([Parameter(Mandatory)][string[]]$DockerArgs)
    $ErrorActionPreference = 'Continue'
    $out = & docker @DockerArgs 2>&1
    $code = $LASTEXITCODE
    return [pscustomobject]@{ Output = ($out -join "`n"); ExitCode = $code }
}

# Llamada a la Web API de SonarQube desde el host. Usa el token como
# usuario basico con contrasena vacia (como hace la UI); si no hay
# token todavia, cae a admin/admin, que es la clave por defecto.
function Invoke-SonarApi {
    param(
        [ValidateSet('GET', 'POST')][string]$Method = 'GET',
        [Parameter(Mandatory)][string]$Path,
        [string]$Body = ''
    )
    $user = if ($Token) { $Token } else { 'admin' }
    $pass = if ($Token) { '' } else { 'admin' }
    $pair = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${user}:${pass}"))
    $headers = @{ Authorization = "Basic $pair" }

    $params = @{
        Uri         = "$SonarUrl/$Path"
        Method      = $Method
        Headers     = $headers
        ErrorAction = 'Stop'
    }
    if ($Method -eq 'POST') { $params.Body = $Body }
    return Invoke-RestMethod @params
}

# --- Comprobaciones previas --------------------------------------------------
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'No se encontro docker en el PATH. Instala Docker Desktop.'
}
if (-not (Test-Path -LiteralPath $ComposeFile)) {
    throw "No se encontro $ComposeFile"
}

if ($ReportsOnly) {
    Write-Step 'Reportes existentes'
    if (Test-Path -LiteralPath $ReportDir) {
        $files = @(Get-ChildItem -LiteralPath $ReportDir -File | Sort-Object LastWriteTime -Descending)
        if ($files.Count -eq 0) {
            Write-Info 'Todavia no hay reportes. Ejecuta el script sin -ReportsOnly.'
        }
        $files | ForEach-Object {
            Write-Host ('    {0,-58} {1,8:n0} bytes  {2}' -f $_.Name, $_.Length, $_.LastWriteTime.ToString('yyyy-MM-dd HH:mm'))
        }
    }
    else {
        Write-Info "No existe la carpeta $ReportDir"
    }
    return
}

if (-not (Test-Path -LiteralPath $ReportDir)) {
    New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null
}

Write-Host 'Synapse / SonarQube' -ForegroundColor White
Write-Info "proyecto Docker : $Project"
Write-Info "compose         : $ComposeFile"
Write-Info "dashboard       : $SonarUrl"
Write-Info "sello           : $Stamp"

# --- 1. Servidor -------------------------------------------------------------
if ($Fresh) {
    Invoke-Compose -DockerArgs ($ComposeArgs + @('down', '-v', '--remove-orphans')) `
        -What 'Destruyendo el SonarQube anterior (-Fresh)' -AllowFailure | Out-Null
}

Invoke-Compose -DockerArgs ($ComposeArgs + @('up', '-d', 'sonarqube')) `
    -What 'Levantando SonarQube Community Build' | Out-Null

Write-Step 'Esperando a que SonarQube responda UP'
$up = $false
for ($i = 1; $i -le 60; $i++) {
    try {
        $status = Invoke-RestMethod -Uri "$SonarUrl/api/system/status" -ErrorAction Stop
        if ($status.status -eq 'UP') { $up = $true; break }
    } catch { }
    Start-Sleep -Seconds 5
}
if (-not $up) {
    Invoke-Compose -DockerArgs ($ComposeArgs + @('logs', '--tail', '80', 'sonarqube')) `
        -What 'Logs del servidor (no respondio a tiempo)' -AllowFailure | Out-Null
    throw "SonarQube no llego a UP en 5 minutos. Revisa los logs anteriores."
}
# Este endpoint devuelve el numero de version como texto plano, no
# como objeto JSON, asi que no siempre viene en una propiedad.
$version = Invoke-SonarApi -Path 'api/server/version'
if ($version -isnot [string]) { $version = Get-Prop $version 'version' 'desconocida' }
Write-Ok "SonarQube $version listo en $SonarUrl"

# --- 2. Token ----------------------------------------------------------------
if (-not $Token) {
    Write-Step 'Generando token de API para el usuario admin'
    try {
        # SonarQube rechaza dos tokens con el mismo nombre (400), asi
        # que el de la corrida anterior se revoca antes de reemitirlo.
        # Si no existe, el revoke falla y no importa: se ignora.
        try { Invoke-SonarApi -Method POST -Path 'api/user_tokens/revoke?name=synapse-runner' | Out-Null } catch { }
        $Token = (Invoke-SonarApi -Method POST -Path 'api/user_tokens/generate?name=synapse-runner').token
    } catch {
        $detail = $_.ErrorDetails.Message
        throw "No se pudo generar el token: $($_.Exception.Message) $detail Si cambiaste la clave de admin, pasala con -Token."
    }
}
$env:SONAR_TOKEN = $Token
Write-Ok 'Token de API listo'

# --- 3. Analisis -------------------------------------------------------------
$scanOutput = ''
$scanOk = $true
if (-not $SkipScan) {
    $scanStart = Get-Date
    Write-Step 'Escaneando con SonarScanner CLI (tarda 1-3 minutos)'
    $scan = Get-ComposeOutput -DockerArgs ($ComposeArgs + @('run', '--rm', 'scanner'))
    $scanOutput = $scan.Output
    if ($scanOutput -match 'ANALYSIS SUCCESSFUL') {
        Write-Ok 'ANALYSIS SUCCESSFUL'
    }     else {
        $scanOk = $false
        Write-Fail "El escaner no termino correctamente (exit $($scan.ExitCode)). Ultimas lineas:"
        @($scanOutput -split "`n") | Select-Object -Last 40 | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        # Si lo que fallo fue el arranque del servidor, el log del
        # servidor es la unica pista util.
        if ($scanOutput -match 'dependency failed to start|is unhealthy') {
            Invoke-Compose -DockerArgs ($ComposeArgs + @('logs', '--tail', '40', 'sonarqube')) `
                -What 'Logs del servidor (el escaner no arranco porque no estaba healthy)' -AllowFailure | Out-Null
        }
        throw 'Analisis fallido. Los reportes no se actualizaron.'
    }
    Write-Info ("Duracion del analisis: {0:n0} segundos" -f ((Get-Date) - $scanStart).TotalSeconds)

    # "ANALYSIS SUCCESSFUL" solo significa que la tarea CE (subir y
    # analizar los archivos) termino. El calculo de metricas es una
    # tarea posterior en background: sin esta espera la exportacion
    # sale vacia aunque el analisis haya ido bien.
    Write-Step 'Esperando el calculo de metricas (tarea en background)'
    $metricsReady = $false
    for ($i = 1; $i -le 40; $i++) {
        try {
            $probe = Invoke-SonarApi -Path ("api/measures/component?component={0}&metricKeys=ncloc" -f
                [uri]::EscapeDataString($ProjectKey))
            if (@(Get-Prop $probe.component 'measures' @()).Count -gt 0) { $metricsReady = $true; break }
        } catch { }
        Start-Sleep -Seconds 3
    }
    if ($metricsReady) { Write-Ok 'Metricas calculadas' }
    else { Write-Fail 'Las metricas siguen sin estar disponibles; el export puede salir vacio' }
} else {
    Write-Step 'Saltando el escaner (-SkipScan): se reexporta la ultima analisis'
}

# --- 4. Exportacion de metricas ----------------------------------------------
Write-Step 'Descargando metricas de /api/measures/component'
$measuresResponse = Invoke-SonarApi -Path ("api/measures/component?component={0}&metricKeys={1}" -f
    [uri]::EscapeDataString($ProjectKey), ($MetricKeys -join ','))
$measures = @($measuresResponse.component.measures)

$gate = 'SIN DATOS'
foreach ($m in $measures) {
    if ($m.metric -eq 'alert_status') {
        # Dependiendo de la version, el estado de la Quality Gate llega
        # en "periodValue" o directamente en "value".
        $pv = Get-Prop $m 'periodValue'
        if (-not $pv) { $pv = Get-Prop $m 'value' }
        if ($pv) { $gate = $pv }
    }
}

$metricRows = @()
foreach ($m in $measures) {
    $label = if ($MetricLabels.ContainsKey($m.metric)) { $MetricLabels[$m.metric] } else { $m.metric }
    $value = Get-Prop $m 'value' ''
    $period = Get-Prop $m 'periodValue' ''
    $metricRows += [pscustomobject]@{
        Metrica   = $m.metric
        Etiqueta  = $label
        Valor     = $value
        Periodo   = $period
        Mejor     = (Get-Prop $m 'bestValue' '')
    }
}

$metricsJson = Join-Path $ReportDir "synapse-metrics-$Stamp.json"
$metricsCsv  = Join-Path $ReportDir "synapse-metrics-$Stamp.csv"
$measuresResponse | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $metricsJson -Encoding UTF8
$metricRows | Export-Csv -LiteralPath $metricsCsv -NoTypeInformation -Encoding UTF8
Write-Ok "Metricas -> $metricsCsv"

# --- 5. Exportacion de issues ------------------------------------------------
Write-Step 'Descargando issues de /api/issues/search'
$issues = @()
$page = 1
$pageSize = 500
$total = 0
do {
    $r = Invoke-SonarApi -Path ("api/issues/search?componentKeys={0}&ps={1}&p={2}&s=FILE_LINE&asc=true" -f
        [uri]::EscapeDataString($ProjectKey), $pageSize, $page)
    $total = [int]$r.total
    $issues += @($r.issues)
    $page++
} while ((($page - 1) * $pageSize) -lt $total -and $page -le 20)

$issueRows = @()
foreach ($i in $issues) {
    $component = [string](Get-Prop $i 'component' '')
    $component = $component -replace ('^{0}:' -f [regex]::Escape($ProjectKey)), ''
    $issueRows += [pscustomobject]@{
        Tipo      = [string](Get-Prop $i 'type' '')
        Severidad = [string](Get-Prop $i 'severity' '')
        Regla     = [string](Get-Prop $i 'rule' '')
        Componente= $component
        Linea     = [string](Get-Prop $i 'line' '')
        Esfuerzo  = [string](Get-Prop $i 'debt' '')
        Autor     = [string](Get-Prop $i 'author' '')
        Creado    = [string](Get-Prop $i 'creationDate' '')
        Estado    = [string](Get-Prop $i 'status' '')
        Asunto    = [string](Get-Prop $i 'cleanCodeAttribute' '')
        Mensaje   = [string](Get-Prop $i 'message' '')
    }
}

$issuesJson = Join-Path $ReportDir "synapse-issues-$Stamp.json"
$issuesCsv  = Join-Path $ReportDir "synapse-issues-$Stamp.csv"
$issueRows | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $issuesJson -Encoding UTF8
$issueRows | Export-Csv -LiteralPath $issuesCsv -NoTypeInformation -Encoding UTF8
Write-Ok "Issues ($total) -> $issuesCsv"

# --- 6. Desglose por archivo -------------------------------------------------
Write-Step 'Descargando desglose por archivo de /api/measures/component_tree'
$tree = Invoke-SonarApi -Path ("api/measures/component_tree?component={0}&metricKeys={1}&strategy=leaves&qualifiers=FIL" -f
    [uri]::EscapeDataString($ProjectKey),
    'ncloc,code_smells,bugs,vulnerabilities,duplicated_lines_density,coverage')

$treeRows = @()
foreach ($c in @($tree.components)) {
    $metrics = @{}
    foreach ($m in @(Get-Prop $c 'measures' @())) { $metrics[$m.metric] = (Get-Prop $m 'value' '') }
    $treeRows += [pscustomobject]@{
        Archivo      = ([string](Get-Prop $c 'path' '')) -replace ('^{0}:' -f [regex]::Escape($ProjectKey)), ''
        Ncloc        = [string]$metrics['ncloc']
        CodeSmells   = [string]$metrics['code_smells']
        Bugs         = [string]$metrics['bugs']
        Vulnerabilidades = [string]$metrics['vulnerabilities']
        DuplicadoPct = [string]$metrics['duplicated_lines_density']
        CoberturaPct = [string]$metrics['coverage']
    }
}

$treeCsv = Join-Path $ReportDir "synapse-archivos-$Stamp.csv"
$treeRows | Export-Csv -LiteralPath $treeCsv -NoTypeInformation -Encoding UTF8
Write-Ok "Desglose por archivo ($($treeRows.Count)) -> $treeCsv"

# --- 7. Resumen --------------------------------------------------------------
function Get-MetricText {
    param([string]$Key, [string]$Fallback = 'n/d')
    $m = $measures | Where-Object { $_.metric -eq $Key } | Select-Object -First 1
    if (-not $m) { return $Fallback }
    $v = Get-Prop $m 'value'
    if ($null -eq $v -or "$v" -eq '') { return $Fallback }
    return "$v"
}

# La Web API devuelve los ratings como 1.0 a 5.0; la UI los muestra como
# A a E. El resumen usa las letras, que es como se documentan.
function Get-RatingLetter {
    param([string]$Key)
    $v = Get-MetricText $Key ''
    if ($v -eq '') { return 'n/d' }
    switch ($v) {
        '1.0' { return 'A' }
        '2.0' { return 'B' }
        '3.0' { return 'C' }
        '4.0' { return 'D' }
        '5.0' { return 'E' }
        default { return $v }
    }
}

$byType = @{}
$bySeverity = @{}
foreach ($r in $issueRows) {
    if ($r.Tipo)    { $byType[$r.Tipo] = 1 + [int]$byType[$r.Tipo] }
    if ($r.Severidad) { $bySeverity[$r.Severidad] = 1 + [int]$bySeverity[$r.Severidad] }
}

$debtMinutes = Get-MetricText 'sqale_index' ''
$debtRatio   = Get-MetricText 'software_quality_maintainability_debt_ratio' ''

$lines = @()
$lines += '==============================================================='
$lines += ' Synapse - Reporte de calidad de codigo (SonarQube)'
$lines += " Ejecutado       : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$lines += " Servidor        : SonarQube $version en $SonarUrl"
$lines += " Proyecto        : $ProjectKey"
$lines += " Quality Gate    : $gate"
$lines += ''
$lines += '--- Clean Code Quality (A = mejor, E = peor) ---'
$lines += (" Mantenibilidad : {0}   (deuda tecnica ratio {1}%)" -f (Get-RatingLetter 'software_quality_maintainability_rating'), $debtRatio)
$lines += (" Fiabilidad     : {0}" -f (Get-RatingLetter 'software_quality_reliability_rating'))
$lines += (" Seguridad      : {0}" -f (Get-RatingLetter 'software_quality_security_rating'))
$lines += (" Rating deuda tecnica: {0}" -f (Get-RatingLetter 'sqale_rating'))
$lines += ''
$lines += '--- Hallazgos ---'
$lines += (" Code smells    : {0}" -f (Get-MetricText 'code_smells'))
$lines += (" Bugs           : {0}" -f (Get-MetricText 'bugs'))
$lines += (" Vulnerabilidades: {0}" -f (Get-MetricText 'vulnerabilities'))
$lines += (" Hotspots seg.  : {0}" -f (Get-MetricText 'security_hotspots'))
if ($debtMinutes -ne '') {
    $hours = [math]::Round(([double]$debtMinutes / 60), 1)
    $lines += (" Deuda tecnica  : {0} min ({1} horas)" -f $debtMinutes, $hours)
}
$lines += ''
$lines += '--- Issues por tipo ---'
foreach ($k in ($byType.Keys | Sort-Object)) { $lines += (" {0,-16}: {1}" -f $k, $byType[$k]) }
$lines += ''
$lines += '--- Issues por severidad ---'
foreach ($k in ($bySeverity.Keys | Sort-Object)) { $lines += (" {0,-16}: {1}" -f $k, $bySeverity[$k]) }
$lines += ''
$lines += '--- Tamano y complejidad ---'
$lines += (" Lineas de codigo (ncloc)   : {0}" -f (Get-MetricText 'ncloc'))
$lines += (" Lineas duplicadas (%)      : {0}" -f (Get-MetricText 'duplicated_lines_density'))
$lines += (" Complejidad ciclomatica    : {0}" -f (Get-MetricText 'complexity'))
$lines += (" Complejidad cognitiva      : {0}" -f (Get-MetricText 'cognitive_complexity'))
$lines += (" Cobertura (%)              : {0}" -f (Get-MetricText 'coverage'))
$lines += ''
$lines += " Dashboard : $SonarUrl  (login admin / admin) -> Projects -> Synapse"
$lines += '==============================================================='
$summaryTxt = Join-Path $ReportDir "synapse-resumen-$Stamp.txt"
$lines | Set-Content -LiteralPath $summaryTxt -Encoding UTF8

Write-Step 'Resumen'
$lines | ForEach-Object { Write-Host "    $_" }

Write-Host ''
Write-Host '    Reportes generados:' -ForegroundColor White
foreach ($f in @($metricsCsv, $issuesCsv, $treeCsv, $metricsJson, $issuesJson, $summaryTxt)) {
    Write-Host ('    -> {0} ({1:n0} bytes)' -f $f, (Get-Item -LiteralPath $f).Length) -ForegroundColor Green
}
Write-Host ''
Write-Info "Dashboard: $SonarUrl  (admin / admin) -> Projects -> Synapse"
Write-Info "Resumen legible: $summaryTxt"

# --- 8. Limpieza -------------------------------------------------------------
if ($Stop) {
    Invoke-Compose -DockerArgs ($ComposeArgs + @('down')) `
        -What 'Bajando SonarQube (-Stop, los volumenes se conservan)' -AllowFailure | Out-Null
}
else {
    Write-Step 'SonarQube sigue arriba'
    Write-Info "$SonarUrl  (admin / admin)"
    Write-Info "docker compose -p $Project -f docker-compose.sonar.yml ps"
    Write-Info "docker compose -p $Project -f docker-compose.sonar.yml down   # para bajarlo"
    Write-Info "docker compose -p $Project -f docker-compose.sonar.yml down -v # para borrarlo todo"
}

Remove-Item Env:SONAR_TOKEN -ErrorAction SilentlyContinue

if (-not $scanOk) { exit 1 }
exit 0
