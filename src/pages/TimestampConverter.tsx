import { useEffect, useState } from 'react'
import ToolLayout from '../components/ToolLayout'
import { useToast } from '../components/toastContext'
import { writeTextToClipboard } from '../utils/clipboard'
import {
  DEFAULT_TIME_ZONE,
  TIME_ZONE_OPTIONS,
  dateTimeToTimestamp,
  formatDateInTimeZone,
  getCurrentTimestamp,
  timestampToDateTime,
  type TimestampUnit,
} from '../utils/timeConverter'
import './TimestampConverter.css'
import '../styles/common.css'

type ConversionMode = 'single' | 'batch'

type BatchResult = {
  input: string
  output: string
}

const TimestampConverter = () => {
  const [conversionMode, setConversionMode] = useState<ConversionMode>('single')
  const [currentUnit, setCurrentUnit] = useState<TimestampUnit>('seconds')
  const [isRunning, setIsRunning] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [timestampInput, setTimestampInput] = useState(() => Date.now().toString())
  const [timestampInputUnit, setTimestampInputUnit] = useState<TimestampUnit>('milliseconds')
  const [timestampOutput, setTimestampOutput] = useState('')
  const [timestampTimeZone, setTimestampTimeZone] = useState(DEFAULT_TIME_ZONE)
  const [dateTimeInput, setDateTimeInput] = useState(() => formatDateInTimeZone(new Date(), DEFAULT_TIME_ZONE))
  const [dateTimeTimeZone, setDateTimeTimeZone] = useState(DEFAULT_TIME_ZONE)
  const [dateTimeOutput, setDateTimeOutput] = useState('')
  const [dateTimeOutputUnit, setDateTimeOutputUnit] = useState<TimestampUnit>('seconds')
  const [batchTimestampInput, setBatchTimestampInput] = useState('')
  const [batchTimestampUnit, setBatchTimestampUnit] = useState<TimestampUnit>('seconds')
  const [batchTimestampTimeZone, setBatchTimestampTimeZone] = useState(DEFAULT_TIME_ZONE)
  const [batchTimestampResults, setBatchTimestampResults] = useState<BatchResult[]>([])
  const [batchDateTimeInput, setBatchDateTimeInput] = useState('')
  const [batchDateTimeTimeZone, setBatchDateTimeTimeZone] = useState(DEFAULT_TIME_ZONE)
  const [batchDateTimeOutputUnit, setBatchDateTimeOutputUnit] = useState<TimestampUnit>('seconds')
  const [batchDateTimeResults, setBatchDateTimeResults] = useState<BatchResult[]>([])
  const [error, setError] = useState('')
  const { showToast } = useToast()

  useEffect(() => {
    if (!isRunning) return

    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, currentUnit === 'seconds' ? 1000 : 100)

    return () => window.clearInterval(timer)
  }, [currentUnit, isRunning])

  const currentTimestamp = getCurrentTimestamp(currentUnit, now)

  const handleCopyCurrent = async () => {
    const success = await writeTextToClipboard(currentTimestamp)
    showToast(success ? '当前时间戳已复制' : '复制失败', success ? 'success' : 'error')
  }

  const convertTimestamp = () => {
    try {
      setError('')
      setTimestampOutput(timestampToDateTime(timestampInput, timestampInputUnit, timestampTimeZone))
    } catch (err) {
      setTimestampOutput('')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const convertDateTime = () => {
    try {
      setError('')
      setDateTimeOutput(dateTimeToTimestamp(dateTimeInput, dateTimeTimeZone, dateTimeOutputUnit))
    } catch (err) {
      setDateTimeOutput('')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const convertBatchTimestamps = () => {
    const lines = parseBatchLines(batchTimestampInput)
    if (lines.length === 0) {
      setBatchTimestampResults([])
      setError('请输入时间戳列表')
      return
    }

    setError('')
    setBatchTimestampResults(lines.map((line) => convertBatchLine(line, () => (
      timestampToDateTime(line, batchTimestampUnit, batchTimestampTimeZone)
    ))))
  }

  const convertBatchDateTimes = () => {
    const lines = parseBatchLines(batchDateTimeInput)
    if (lines.length === 0) {
      setBatchDateTimeResults([])
      setError('请输入日期时间列表')
      return
    }

    setError('')
    setBatchDateTimeResults(lines.map((line) => convertBatchLine(line, () => (
      dateTimeToTimestamp(line, batchDateTimeTimeZone, batchDateTimeOutputUnit)
    ))))
  }

  return (
    <ToolLayout
      className="timestamp-converter"
      title="时间戳转换"
      description="查看当前时间戳，并在时间戳和日期时间之间转换"
      status={error ? <div className="timestamp-error">{error}</div> : null}
    >
      <section className="timestamp-current-card">
        <div className="timestamp-section-heading">
          <h3>当前时间戳</h3>
        </div>
        <div className="timestamp-current-value">
          <span>{currentTimestamp}</span>
          <small>{currentUnit === 'seconds' ? '秒' : '毫秒'}</small>
        </div>
        <div className="timestamp-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCurrentUnit((unit) => unit === 'seconds' ? 'milliseconds' : 'seconds')}
          >
            切换单位
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleCopyCurrent}>
            复制
          </button>
          <button
            type="button"
            className={isRunning ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={() => setIsRunning((running) => !running)}
          >
            {isRunning ? '停止' : '开始'}
          </button>
        </div>
      </section>

      <section className="timestamp-convert-card">
        <div className="timestamp-tabs" aria-label="转换模式">
          <button
            type="button"
            className={conversionMode === 'single' ? 'active' : ''}
            aria-pressed={conversionMode === 'single'}
            onClick={() => setConversionMode('single')}
          >
            单个转换
          </button>
          <button
            type="button"
            className={conversionMode === 'batch' ? 'active' : ''}
            aria-pressed={conversionMode === 'batch'}
            onClick={() => setConversionMode('batch')}
          >
            批量转换
          </button>
        </div>

        {conversionMode === 'single' ? (
          <>
            <div className="timestamp-form-section">
              <h3>时间戳转日期时间</h3>
              <div className="timestamp-form-grid timestamp-to-date-grid">
                <input
                  aria-label="时间戳"
                  value={timestampInput}
                  onChange={(event) => setTimestampInput(event.target.value)}
                  placeholder="请输入时间戳"
                />
                <select
                  aria-label="时间戳单位"
                  value={timestampInputUnit}
                  onChange={(event) => setTimestampInputUnit(event.target.value as TimestampUnit)}
                >
                  <option value="seconds">秒(s)</option>
                  <option value="milliseconds">毫秒(ms)</option>
                </select>
                <button type="button" className="btn btn-primary" onClick={convertTimestamp}>
                  转换
                </button>
                <input aria-label="时间戳转换结果" value={timestampOutput} readOnly placeholder="转换结果" />
                <select
                  aria-label="目标时区"
                  value={timestampTimeZone}
                  onChange={(event) => setTimestampTimeZone(event.target.value)}
                >
                  {TIME_ZONE_OPTIONS.map((timeZone) => (
                    <option key={timeZone} value={timeZone}>{timeZone}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="timestamp-form-section">
              <h3>日期时间转时间戳</h3>
              <div className="timestamp-form-grid date-to-timestamp-grid">
                <input
                  aria-label="日期时间"
                  value={dateTimeInput}
                  onChange={(event) => setDateTimeInput(event.target.value)}
                  placeholder="YYYY-MM-DD HH:mm:ss"
                />
                <select
                  aria-label="日期时区"
                  value={dateTimeTimeZone}
                  onChange={(event) => setDateTimeTimeZone(event.target.value)}
                >
                  {TIME_ZONE_OPTIONS.map((timeZone) => (
                    <option key={timeZone} value={timeZone}>{timeZone}</option>
                  ))}
                </select>
                <button type="button" className="btn btn-primary" onClick={convertDateTime}>
                  转换
                </button>
                <input aria-label="日期时间转换结果" value={dateTimeOutput} readOnly placeholder="转换结果" />
                <select
                  aria-label="输出时间戳单位"
                  value={dateTimeOutputUnit}
                  onChange={(event) => setDateTimeOutputUnit(event.target.value as TimestampUnit)}
                >
                  <option value="seconds">秒(s)</option>
                  <option value="milliseconds">毫秒(ms)</option>
                </select>
              </div>
            </div>
          </>
        ) : (
          <div className="timestamp-batch-panel">
            <div className="timestamp-batch-section">
              <h3>批量时间戳转日期时间</h3>
              <label className="timestamp-field">
                <span>时间戳列表（每行一个）</span>
                <textarea
                  aria-label="批量时间戳列表"
                  value={batchTimestampInput}
                  onChange={(event) => setBatchTimestampInput(event.target.value)}
                  placeholder="输入时间戳列表"
                  rows={6}
                />
              </label>
              <div className="timestamp-batch-controls">
                <label className="timestamp-field">
                  <span>时区</span>
                  <select
                    aria-label="批量目标时区"
                    value={batchTimestampTimeZone}
                    onChange={(event) => setBatchTimestampTimeZone(event.target.value)}
                  >
                    {TIME_ZONE_OPTIONS.map((timeZone) => (
                      <option key={timeZone} value={timeZone}>{timeZone}</option>
                    ))}
                  </select>
                </label>
                <select
                  aria-label="批量时间戳单位"
                  value={batchTimestampUnit}
                  onChange={(event) => setBatchTimestampUnit(event.target.value as TimestampUnit)}
                >
                  <option value="seconds">秒(s)</option>
                  <option value="milliseconds">毫秒(ms)</option>
                </select>
              </div>
              <button type="button" className="btn btn-primary" onClick={convertBatchTimestamps}>
                转换
              </button>
              <BatchResultTable results={batchTimestampResults} />
            </div>

            <div className="timestamp-batch-section">
              <h3>批量日期时间转时间戳</h3>
              <label className="timestamp-field">
                <span>日期时间列表（每行一个）</span>
                <textarea
                  aria-label="批量日期时间列表"
                  value={batchDateTimeInput}
                  onChange={(event) => setBatchDateTimeInput(event.target.value)}
                  placeholder="输入日期时间列表"
                  rows={6}
                />
              </label>
              <div className="timestamp-batch-controls">
                <label className="timestamp-field">
                  <span>时区</span>
                  <select
                    aria-label="批量日期时区"
                    value={batchDateTimeTimeZone}
                    onChange={(event) => setBatchDateTimeTimeZone(event.target.value)}
                  >
                    {TIME_ZONE_OPTIONS.map((timeZone) => (
                      <option key={timeZone} value={timeZone}>{timeZone}</option>
                    ))}
                  </select>
                </label>
                <select
                  aria-label="批量输出时间戳单位"
                  value={batchDateTimeOutputUnit}
                  onChange={(event) => setBatchDateTimeOutputUnit(event.target.value as TimestampUnit)}
                >
                  <option value="seconds">秒(s)</option>
                  <option value="milliseconds">毫秒(ms)</option>
                </select>
              </div>
              <button type="button" className="btn btn-primary" onClick={convertBatchDateTimes}>
                转换
              </button>
              <BatchResultTable results={batchDateTimeResults} />
            </div>
          </div>
        )}
      </section>
    </ToolLayout>
  )
}

function parseBatchLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function convertBatchLine(input: string, convert: () => string): BatchResult {
  try {
    return { input, output: convert() }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { input, output: `错误: ${message}` }
  }
}

function BatchResultTable({ results }: { results: BatchResult[] }) {
  return (
    <div className="timestamp-result-table" aria-label="转换结果">
      <div className="timestamp-result-row header">
        <span>输入</span>
        <span>输出</span>
      </div>
      {results.map((result, index) => (
        <div className="timestamp-result-row" key={`${result.input}-${index}`}>
          <span title={result.input}>{result.input}</span>
          <span className={result.output.startsWith('错误:') ? 'error' : ''} title={result.output}>
            {result.output}
          </span>
        </div>
      ))}
    </div>
  )
}

export default TimestampConverter
