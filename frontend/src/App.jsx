import { useState, useRef } from 'react'
import axios from 'axios'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter,
  Legend, AreaChart, Area, Label
} from 'recharts'
import {
  Upload, Plus, Trash2, FileText, BarChart2, PieChart as PieIcon,
  Activity, TrendingUp, AlertCircle, CheckCircle, Layers, Download, Check
} from 'lucide-react'

// ============================================
// CONFIGURACIÓN
// ============================================
// En producción usa Render, en desarrollo usa localhost
const API_URL = import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' ? 'http://localhost:8000' : 'https://analista-backend.onrender.com')

export default function App() {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [dashboardCharts, setDashboardCharts] = useState([])
  const [fileInfo, setFileInfo] = useState(null)
  const [error, setError] = useState(null)
  const [hasUploadedBefore, setHasUploadedBefore] = useState(false)
  const [exporting, setExporting] = useState(false)
  const fileInputRef = useRef(null)
  const dashboardRef = useRef(null)

  // ============================================
  // HELPERS
  // ============================================

  // Verificar si una sugerencia ya está en el dashboard
  const isInDashboard = (suggestion) => {
    return dashboardCharts.some(chart =>
      chart.title === suggestion.title &&
      chart.chart_type === suggestion.chart_type
    )
  }

  // ============================================
  // HANDLERS
  // ============================================

  const handleFileUpload = async (file) => {
    if (!file) return

    const validTypes = ['.csv', '.xlsx', '.xls']
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!validTypes.includes(fileExt)) {
      setError(`Formato no soportado. Use: ${validTypes.join(', ')}`)
      return
    }

    setLoading(true)
    setError(null)
    setSuggestions([])
    setDashboardCharts([])

    // Resetear el input para permitir seleccionar el mismo archivo
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await axios.post(`${API_URL}/upload`, formData, {
        timeout: 60000
      })

      if (res.data.chart_suggestions) {
        setSuggestions(res.data.chart_suggestions)
        setFileInfo({
          name: res.data.filename,
          rows: res.data.rows,
          columns: res.data.columns?.length || 0
        })
        setHasUploadedBefore(true)
      }
    } catch (err) {
      console.error('Error en upload:', err)
      if (err.code === 'ECONNREFUSED' || err.message.includes('Network Error')) {
        setError('No se pudo conectar al servidor. ¿Está corriendo el backend en ' + API_URL + '?')
      } else if (err.response?.data?.detail) {
        setError(err.response.data.detail)
      } else {
        setError('Error procesando el archivo. Por favor intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  const addToDashboard = async (suggestion) => {
    // Evitar duplicados
    if (isInDashboard(suggestion)) return

    try {
      const res = await axios.post(`${API_URL}/chart-data`, {
        chart_type: suggestion.chart_type,
        x: suggestion.parameters.x,
        y: suggestion.parameters.y
      })

      const newChart = {
        ...suggestion,
        id: Date.now(),
        data: res.data.labels
          ? res.data.labels.map((l, i) => ({ name: String(l), value: res.data.values[i] }))
          : res.data.data
      }

      setDashboardCharts(prev => [...prev, newChart])
      setError(null) // Limpiar errores previos si tiene éxito
    } catch (err) {
      console.error('Error obteniendo datos:', err)
      // Mostrar error más específico
      const errorDetail = err.response?.data?.detail || 'Error desconocido'
      setError(`Error al agregar "${suggestion.title.substring(0, 40)}...": ${errorDetail}`)
    }
  }

  const removeChart = (id) => {
    setDashboardCharts(prev => prev.filter(c => c.id !== id))
  }

  // ============================================
  // EXPORTAR A PDF
  // ============================================
  const exportToPDF = async () => {
    if (dashboardCharts.length === 0) {
      setError('No hay gráficos para exportar.')
      return
    }

    setExporting(true)

    try {
      // Importar html2canvas y jspdf dinámicamente
      const [html2canvasModule, jsPDFModule] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ])
      const html2canvas = html2canvasModule.default
      const { jsPDF } = jsPDFModule

      const pdf = new jsPDF('l', 'mm', 'a4') // Landscape
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      // Obtener todos los elementos de gráficos del dashboard
      const chartElements = dashboardRef.current?.querySelectorAll('[data-chart-id]')
      const charts = chartElements ? Array.from(chartElements) : []

      // Si no hay elementos con data-chart-id, capturar el dashboard completo
      if (charts.length === 0) {
        const dashboard = dashboardRef.current
        if (!dashboard) {
          setExporting(false)
          return
        }

        const canvas = await html2canvas(dashboard, {
          scale: 1.5,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        })

        const imgData = canvas.toDataURL('image/jpeg', 0.85)

        // Header
        addPDFHeader(pdf, pageWidth, 1, 1)

        // Imagen
        const imgWidth = pageWidth - 20
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        const maxHeight = pageHeight - 50

        if (imgHeight > maxHeight) {
          const scaledWidth = (canvas.width * maxHeight) / canvas.height
          pdf.addImage(imgData, 'JPEG', 10, 35, scaledWidth, maxHeight)
        } else {
          pdf.addImage(imgData, 'JPEG', 10, 35, imgWidth, imgHeight)
        }

        // Footer
        addPDFFooter(pdf, pageWidth, pageHeight)

      } else {
        // Cada gráfico en su propia página (1 por página)
        const numCharts = charts.length

        for (let i = 0; i < numCharts; i++) {
          if (i > 0) pdf.addPage()

          const chartEl = charts[i]
          const canvas = await html2canvas(chartEl, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          })

          const imgData = canvas.toDataURL('image/jpeg', 0.9)

          // Header con número de página
          addPDFHeader(pdf, pageWidth, i + 1, numCharts)

          // Calcular tamaño para ocupar toda la página
          const maxWidth = pageWidth - 20
          const maxHeight = pageHeight - 55
          const aspectRatio = canvas.width / canvas.height

          let finalWidth = maxWidth
          let finalHeight = maxWidth / aspectRatio

          if (finalHeight > maxHeight) {
            finalHeight = maxHeight
            finalWidth = maxHeight * aspectRatio
          }

          // Centrar horizontalmente
          const xPos = (pageWidth - finalWidth) / 2
          const yPos = 40

          pdf.addImage(imgData, 'JPEG', xPos, yPos, finalWidth, finalHeight)
          addPDFFooter(pdf, pageWidth, pageHeight)
        }
      }

      // Generar nombre de archivo limpio
      const baseName = fileInfo ? fileInfo.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_') : 'dashboard'
      const timestamp = new Date().toISOString().slice(0, 10)
      const fileName = `${baseName}_dashboard_${timestamp}.pdf`

      // Descargar
      const pdfBlob = pdf.output('blob')
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

    } catch (err) {
      console.error('Error exportando PDF:', err)
      setError('Error al exportar. Por favor intenta de nuevo.')
    } finally {
      setExporting(false)
    }
  }

  // Función auxiliar para header del PDF
  const addPDFHeader = (pdf, pageWidth, currentPage, totalPages) => {
    pdf.setFontSize(18)
    pdf.setTextColor(0, 0, 0)
    pdf.text('Analista al Instante - Dashboard', 10, 15)

    pdf.setFontSize(10)
    pdf.setTextColor(128, 128, 128)
    const dateStr = new Date().toLocaleDateString('es-ES', {
      year: 'numeric', month: 'long', day: 'numeric'
    })
    pdf.text(`${dateStr}`, 10, 22)

    if (fileInfo) {
      pdf.text(`${fileInfo.name} | ${fileInfo.rows.toLocaleString()} filas`, 10, 28)
    }

    // Número de página
    pdf.text(`Página ${currentPage} de ${totalPages}`, pageWidth - 10, 15, { align: 'right' })
  }

  // Función auxiliar para footer del PDF
  const addPDFFooter = (pdf, pageWidth, pageHeight) => {
    pdf.setFontSize(8)
    pdf.setTextColor(180, 180, 180)
    pdf.text('Powered by Google Gemini AI', pageWidth / 2, pageHeight - 5, { align: 'center' })
  }

  // ============================================
  // RENDERIZADO DE GRÁFICOS
  // ============================================

  const renderChart = (chart) => {
    const data = chart.data
    const COLORS = ['#000000', '#374151', '#6b7280', '#9ca3af', '#d1d5db']
    const xLabel = chart.parameters?.x || 'Categoría'
    const yLabel = chart.parameters?.y || 'Valor'

    if (chart.chart_type === 'bar') {
      return (
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={80}
          >
            <Label value={xLabel} position="insideBottom" offset={-50} style={{ fontSize: 12, fill: '#6b7280' }} />
          </XAxis>
          <YAxis tick={{ fontSize: 11 }}>
            <Label value={yLabel} angle={-90} position="insideLeft" style={{ fontSize: 12, fill: '#6b7280', textAnchor: 'middle' }} />
          </YAxis>
          <Tooltip
            cursor={{ fill: '#f3f4f6' }}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
          />
          <Bar dataKey="value" fill="#000000" radius={[4, 4, 0, 0]} />
        </BarChart>
      )
    }

    if (chart.chart_type === 'line') {
      return (
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }}>
            <Label value={xLabel} position="insideBottom" offset={-5} style={{ fontSize: 12, fill: '#6b7280' }} />
          </XAxis>
          <YAxis tick={{ fontSize: 11 }}>
            <Label value={yLabel} angle={-90} position="insideLeft" style={{ fontSize: 12, fill: '#6b7280', textAnchor: 'middle' }} />
          </YAxis>
          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#000000"
            strokeWidth={2}
            dot={{ r: 4, fill: '#000' }}
            activeDot={{ r: 6, fill: '#000' }}
          />
        </LineChart>
      )
    }

    if (chart.chart_type === 'area') {
      return (
        <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#000000" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#000000" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }}>
            <Label value={xLabel} position="insideBottom" offset={-5} style={{ fontSize: 12, fill: '#6b7280' }} />
          </XAxis>
          <YAxis tick={{ fontSize: 11 }}>
            <Label value={yLabel} angle={-90} position="insideLeft" style={{ fontSize: 12, fill: '#6b7280', textAnchor: 'middle' }} />
          </YAxis>
          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#000000"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorValue)"
          />
        </AreaChart>
      )
    }

    if (chart.chart_type === 'pie') {
      return (
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            labelLine={{ stroke: '#9ca3af' }}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
          <Legend />
        </PieChart>
      )
    }

    if (chart.chart_type === 'scatter') {
      const xKey = chart.parameters?.x || 'x'
      const yKey = chart.parameters?.y || 'y'
      return (
        <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" dataKey={xKey} name={xKey} tick={{ fontSize: 11 }}>
            <Label value={xKey} position="insideBottom" offset={-5} style={{ fontSize: 12, fill: '#6b7280', fontWeight: 'bold' }} />
          </XAxis>
          <YAxis type="number" dataKey={yKey} name={yKey} tick={{ fontSize: 11 }}>
            <Label value={yKey} angle={-90} position="insideLeft" style={{ fontSize: 12, fill: '#6b7280', fontWeight: 'bold', textAnchor: 'middle' }} />
          </YAxis>
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
            formatter={(value, name) => [value, name]}
          />
          <Scatter data={chart.data} fill="#000000" />
        </ScatterChart>
      )
    }

    return <div className="text-gray-400 text-sm flex items-center justify-center h-full">Visualización no disponible</div>
  }

  const getIcon = (type) => {
    const iconClass = "w-5 h-5"
    if (type === 'bar') return <BarChart2 className={iconClass} />
    if (type === 'pie') return <PieIcon className={iconClass} />
    if (type === 'line') return <TrendingUp className={iconClass} />
    if (type === 'area') return <Layers className={iconClass} />
    return <Activity className={iconClass} />
  }

  const getChartTypeName = (type) => {
    const names = {
      'bar': 'Barras',
      'line': 'Líneas',
      'pie': 'Circular',
      'scatter': 'Dispersión',
      'area': 'Área'
    }
    return names[type] || type.toUpperCase()
  }

  // Limpiar emojis de los títulos para presentación más formal
  const cleanTitle = (title) => {
    // Remover emojis del inicio del título
    return title.replace(/^[\u{1F300}-\u{1F9FF}][\s]*/gu, '').trim()
  }

  // ============================================
  // UI
  // ============================================

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-black selection:text-white">

      {/* HEADER */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-black rounded-lg flex items-center justify-center text-white font-bold text-sm">AI</div>
            <div>
              <span className="font-bold text-lg tracking-tight">Analista al Instante</span>
              <p className="text-xs text-gray-400">Powered by Gemini AI</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {fileInfo && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <FileText className="w-4 h-4" />
                <span className="font-medium">{fileInfo.name}</span>
                <span className="text-gray-300">|</span>
                <span>{fileInfo.rows.toLocaleString()} filas</span>
              </div>
            )}
            {dashboardCharts.length > 0 && (
              <button
                onClick={exportToPDF}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">
                  {exporting ? 'Exportando...' : 'Exportar PDF'}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-16">

        {/* ERROR MESSAGE */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-fade-in-up">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600 text-xl leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* HERO / ZONA DE CARGA */}
        <section className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight text-black">
            Tus datos, <span className="text-gray-400">revelados.</span>
          </h1>
          <p className="text-gray-500 text-lg mb-8">
            Sube tu archivo Excel o CSV y deja que la Inteligencia Artificial
            encuentre los patrones ocultos y genere visualizaciones profesionales.
          </p>

          {/* DRAG & DROP */}
          <div
            onClick={() => fileInputRef.current.click()}
            onDrop={(e) => {
              e.preventDefault()
              if (e.dataTransfer.files?.[0]) {
                handleFileUpload(e.dataTransfer.files[0])
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            className={`
              group relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 cursor-pointer overflow-hidden
              ${loading ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-black hover:bg-gray-50'}
            `}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => handleFileUpload(e.target.files[0])}
            />

            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300">
                {loading ? (
                  <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-6 h-6 text-gray-800" />
                )}
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-lg">
                  {loading
                    ? 'La IA está analizando tus datos...'
                    : hasUploadedBefore
                      ? 'Arrastra otro archivo aquí'
                      : 'Arrastra tu archivo aquí'
                  }
                </p>
                {!loading && (
                  <p className="text-sm text-gray-400">
                    o haz clic para explorar (.csv, .xlsx)
                  </p>
                )}
                {loading && <p className="text-sm text-gray-400">Esto puede tomar unos segundos</p>}
              </div>
            </div>
          </div>

          {hasUploadedBefore && !loading && (
            <p className="text-xs text-gray-400 mt-3">
              💡 Al subir un nuevo archivo, el dashboard actual se limpiará automáticamente
            </p>
          )}
        </section>

        {/* GRID DE INSIGHTS */}
        {suggestions.length > 0 && (
          <section className="animate-fade-in-up">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-px flex-1 bg-gray-100"></div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-gray-600">
                  {suggestions.length} Insights Detectados por IA
                </span>
              </div>
              <div className="h-px flex-1 bg-gray-100"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {suggestions.map((card, idx) => {
                const alreadyAdded = isInDashboard(card)

                return (
                  <div
                    key={idx}
                    className={`group relative bg-white border rounded-xl p-6 transition-all duration-300 shadow-sm flex flex-col justify-between h-full
                      ${alreadyAdded
                        ? 'border-green-200 bg-green-50/30'
                        : 'border-gray-100 hover:bg-black hover:border-black hover:shadow-xl'
                      }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className={`p-2 rounded-lg transition-colors ${alreadyAdded ? 'bg-green-100' : 'bg-gray-50 group-hover:bg-gray-800'}`}>
                          <div className={`transition-colors ${alreadyAdded ? 'text-green-600' : 'text-black group-hover:text-white'}`}>
                            {getIcon(card.chart_type)}
                          </div>
                        </div>
                        <span className={`text-xs font-medium uppercase ${alreadyAdded ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-500'}`}>
                          {getChartTypeName(card.chart_type)}
                        </span>
                      </div>
                      <h3 className={`font-bold text-lg mb-3 leading-tight transition-colors ${alreadyAdded ? 'text-green-800' : 'group-hover:text-white'}`}>
                        {cleanTitle(card.title)}
                      </h3>
                      <p className={`text-sm leading-relaxed transition-colors ${alreadyAdded ? 'text-green-700' : 'text-gray-500 group-hover:text-gray-400'}`}>
                        {card.insight}
                      </p>
                    </div>

                    <button
                      onClick={() => !alreadyAdded && addToDashboard(card)}
                      disabled={alreadyAdded}
                      className={`w-full mt-6 py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200
                        ${alreadyAdded
                          ? 'bg-green-100 text-green-700 border border-green-200 cursor-default'
                          : 'border border-gray-200 group-hover:bg-white group-hover:text-black group-hover:border-white hover:!scale-105 active:scale-95'
                        }`}
                    >
                      {alreadyAdded ? (
                        <>
                          <Check className="w-4 h-4" />
                          Añadido al Dashboard
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Agregar al Dashboard
                        </>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* DASHBOARD PRINCIPAL */}
        {dashboardCharts.length > 0 && (
          <section className="space-y-8 animate-fade-in-up pb-20">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Tu Dashboard</h2>
              <span className="text-sm text-gray-400">{dashboardCharts.length} gráfico(s)</span>
            </div>

            {/* Grid adaptativo: 1 gráfico = 2 columnas, 2+ gráficos = 1 columna (ancho completo) */}
            <div
              ref={dashboardRef}
              className={`grid gap-6 bg-white ${dashboardCharts.length === 1
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-1'  /* Ancho completo para cada gráfico cuando hay múltiples */
                }`}
            >
              {dashboardCharts.map((chart, idx) => {
                // Solo aplica span-2 si hay 1 gráfico
                const spanClass = dashboardCharts.length === 1 ? "md:col-span-2" : ""

                return (
                  <div
                    key={chart.id}
                    data-chart-id={chart.id}
                    className={`bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow ${spanClass}`}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getIcon(chart.chart_type)}
                          <span className="text-xs text-gray-400 uppercase">{getChartTypeName(chart.chart_type)}</span>
                        </div>
                        <h3 className="font-bold text-lg">{cleanTitle(chart.title)}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed mt-1">{chart.insight}</p>
                      </div>
                      <button
                        onClick={() => removeChart(chart.id)}
                        className="ml-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar gráfico"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {renderChart(chart)}
                      </ResponsiveContainer>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-gray-400">
          <p>Analista al Instante © {new Date().getFullYear()} | Powered by Google Gemini AI</p>
        </div>
      </footer>
    </div>
  )
}