/* eslint-disable import/no-unresolved */
import { expect, test, vi } from 'vitest'

import { BenefitApplicationsLanding } from '../../components/benefit-applications-landing'
import type { VisibilityType } from '@/components/visibility-selector'
import { render } from 'vitest-browser-react'

// Mock props object
const mockProps = vi.hoisted(() => ({
    input: '',
    setInput: vi.fn(),
    isReadonly: false,
    chatId: 'test-chat-id',
    sendMessage: vi.fn(),
    selectedVisibilityType: 'private' as VisibilityType,
    status: 'ready' as const,
    stop: vi.fn(),
    attachments: [],
    setAttachments: vi.fn(),
    messages: [],
    setMessages: vi.fn(),
}))

test('BenefitApplicationsLanding renders', async () => {
    const { getByText } = render(<BenefitApplicationsLanding {...mockProps} />)

    await expect.element(getByText(/Get started on/)).toBeInTheDocument()
    await expect.element(getByText(/benefit applications/)).toBeInTheDocument()
})

test('BenefitApplications Landing can handle input and enable send button', async () => {
    mockProps.input = 'test input'
    const { getByText, getByTestId } = render(<BenefitApplicationsLanding {...mockProps} />)

    await expect.element(getByText(/test input/)).toBeInTheDocument()
    await expect.element(getByTestId('send-button')).toBeEnabled()
})

test('BenefitApplications Landing can handle input and disable send button when input is empty', async () => {
    mockProps.input = ''
    const { getByText, getByTestId } = render(<BenefitApplicationsLanding {...mockProps} />)

    await expect.element(getByText(/test input/)).not.toBeInTheDocument()
    await expect.element(getByTestId('send-button')).toBeDisabled()
})

test('BenefitApplications Landing can route to chat page when send button is clicked', async () => {
    mockProps.input = 'test input'
    const { getByText, getByTestId } = render(<BenefitApplicationsLanding {...mockProps} />)

    await expect.element(getByText(/test input/)).toBeInTheDocument()
    await expect.element(getByTestId('send-button')).toBeEnabled()

    await getByTestId('send-button').click()

    await expect(mockProps.sendMessage).toHaveBeenCalled()
    await expect(window.location.pathname).toBe('/chat/test-chat-id')
})