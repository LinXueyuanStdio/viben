import { describe, it, expect, vi, beforeEach } from 'vitest'

const CANCEL = Symbol.for('cancel')

const mockClack = {
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  password: vi.fn(),
  multiselect: vi.fn(),
  log: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    step: vi.fn(),
  },
  spinner: vi.fn(),
  note: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn((v: unknown) => typeof v === 'symbol'),
}

vi.mock('@clack/prompts', () => mockClack)

// Import after mock
const { createTerminalIO } = await import('../terminal-io.js')

describe('TerminalIO', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates text() to clack.text', async () => {
    mockClack.text.mockResolvedValue('hello')
    const io = createTerminalIO()
    const result = await io.text({ message: 'Enter name' })
    expect(result).toBe('hello')
    expect(mockClack.text).toHaveBeenCalledWith({ message: 'Enter name' })
  })

  it('delegates select() to clack.select', async () => {
    mockClack.select.mockResolvedValue('opt1')
    const io = createTerminalIO()
    const opts = { message: 'Pick one', options: [{ value: 'opt1', label: 'Option 1' }] }
    const result = await io.select(opts)
    expect(result).toBe('opt1')
    expect(mockClack.select).toHaveBeenCalledWith(opts)
  })

  it('delegates confirm() to clack.confirm', async () => {
    mockClack.confirm.mockResolvedValue(true)
    const io = createTerminalIO()
    const result = await io.confirm({ message: 'Sure?' })
    expect(result).toBe(true)
    expect(mockClack.confirm).toHaveBeenCalledWith({ message: 'Sure?' })
  })

  it('delegates password() to clack.password', async () => {
    mockClack.password.mockResolvedValue('secret')
    const io = createTerminalIO()
    const result = await io.password({ message: 'Enter password' })
    expect(result).toBe('secret')
    expect(mockClack.password).toHaveBeenCalledWith({ message: 'Enter password' })
  })

  it('delegates multiselect() to clack.multiselect', async () => {
    mockClack.multiselect.mockResolvedValue(['a', 'b'])
    const io = createTerminalIO()
    const opts = {
      message: 'Pick many',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    }
    const result = await io.multiselect(opts)
    expect(result).toEqual(['a', 'b'])
    expect(mockClack.multiselect).toHaveBeenCalledWith(opts)
  })

  it('handles clack cancel symbol by throwing', async () => {
    mockClack.text.mockResolvedValue(CANCEL)
    const io = createTerminalIO()
    await expect(io.text({ message: 'Enter name' })).rejects.toThrow('cancelled')
  })

  it('delegates log methods (info, success, warning, error, step)', () => {
    const io = createTerminalIO()
    io.log.info('info msg')
    io.log.success('success msg')
    io.log.warning('warning msg')
    io.log.error('error msg')
    io.log.step('step msg')
    expect(mockClack.log.info).toHaveBeenCalledWith('info msg')
    expect(mockClack.log.success).toHaveBeenCalledWith('success msg')
    expect(mockClack.log.warning).toHaveBeenCalledWith('warning msg')
    expect(mockClack.log.error).toHaveBeenCalledWith('error msg')
    expect(mockClack.log.step).toHaveBeenCalledWith('step msg')
  })

  it('delegates note() to clack.note', () => {
    const io = createTerminalIO()
    io.note('some note', 'Title')
    expect(mockClack.note).toHaveBeenCalledWith('some note', 'Title')
  })

  it('delegates cancel() to clack.cancel', () => {
    const io = createTerminalIO()
    io.cancel('Goodbye')
    expect(mockClack.cancel).toHaveBeenCalledWith('Goodbye')
  })

  it('creates spinner that delegates to clack.spinner', () => {
    const mockSpinner = { start: vi.fn(), stop: vi.fn(), message: vi.fn() }
    mockClack.spinner.mockReturnValue(mockSpinner)
    const io = createTerminalIO()
    const s = io.spinner()

    s.start('Loading...')
    expect(mockSpinner.start).toHaveBeenCalledWith('Loading...')

    s.stop('Done')
    expect(mockSpinner.stop).toHaveBeenCalledWith('Done')

    s.fail('Oops')
    expect(mockSpinner.stop).toHaveBeenCalledWith('Oops')
  })

  it('spinner fail uses default message when none provided', () => {
    const mockSpinner = { start: vi.fn(), stop: vi.fn(), message: vi.fn() }
    mockClack.spinner.mockReturnValue(mockSpinner)
    const io = createTerminalIO()
    const s = io.spinner()
    s.fail()
    expect(mockSpinner.stop).toHaveBeenCalledWith('Failed')
  })
})
