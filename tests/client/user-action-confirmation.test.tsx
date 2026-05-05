import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { UserActionConfirmation } from '@/components/ai-elements/user-action-confirmation';

test('UserActionConfirmation renders with proper content in approval-requested state', async () => {
  const mockOnApprove = vi.fn();
  const mockOnReject = vi.fn();
  const { getByText } = render(
    <UserActionConfirmation
      approval={{ id: 'test-1', approved: undefined }}
      state="approval-requested"
      requestMessage="Complete the CAPTCHA and submit the application."
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  await expect.element(getByText('Action required')).toBeInTheDocument();
  await expect.element(getByText('Complete the CAPTCHA and submit the application.')).toBeInTheDocument();
  await expect.element(getByText('Take control')).toBeInTheDocument();
  await expect.element(getByText('Skip for now')).toBeInTheDocument();
});

test('UserActionConfirmation calls onApprove when Take control button is clicked', async () => {
  const mockOnApprove = vi.fn();
  const mockOnReject = vi.fn();
  const { getByRole } = render(
    <UserActionConfirmation
      approval={{ id: 'test-2', approved: undefined }}
      state="approval-requested"
      requestMessage="Complete the CAPTCHA and submit the application."
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  const approveButton = getByRole('button', { name: /take control/i });
  await approveButton.click();

  expect(mockOnApprove).toHaveBeenCalledTimes(1);
  expect(mockOnApprove).toHaveBeenCalledWith('test-2');
});

test('UserActionConfirmation calls onReject when Skip for now button is clicked', async () => {
  const mockOnApprove = vi.fn();
  const mockOnReject = vi.fn();
  const { getByRole } = render(
    <UserActionConfirmation
      approval={{ id: 'test-3', approved: undefined }}
      state="approval-requested"
      requestMessage="Complete the CAPTCHA and submit the application."
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  const rejectButton = getByRole('button', { name: /skip for now/i });
  await rejectButton.click();

  expect(mockOnReject).toHaveBeenCalledTimes(1);
  expect(mockOnReject).toHaveBeenCalledWith('test-3');
});

test('UserActionConfirmation supports custom messages', async () => {
  const mockOnApprove = vi.fn();
  const mockOnReject = vi.fn();
  const { getByText } = render(
    <UserActionConfirmation
      approval={{ id: 'test-4', approved: undefined }}
      state="approval-requested"
      requestTitle="Custom Title"
      requestMessage="Custom action required message."
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  await expect.element(getByText('Custom Title')).toBeInTheDocument();
  await expect.element(getByText('Custom action required message.')).toBeInTheDocument();
});

test('UserActionConfirmation does not show Skip for now button when onReject is not provided', async () => {
  const mockOnApprove = vi.fn();
  const { getByRole, getByText } = render(
    <UserActionConfirmation
      approval={{ id: 'test-5', approved: undefined }}
      state="approval-requested"
      requestMessage="Complete the CAPTCHA and submit the application."
      onApprove={mockOnApprove}
    />
  );

  const approveButton = getByRole('button', { name: /take control/i });
  await expect.element(approveButton).toBeInTheDocument();

  await expect.element(getByText('Skip for now')).not.toBeInTheDocument();
});

test('UserActionConfirmation shows Skip for now button when onReject is provided', async () => {
  const mockOnApprove = vi.fn();
  const mockOnReject = vi.fn();
  const { getByRole } = render(
    <UserActionConfirmation
      approval={{ id: 'test-6', approved: undefined }}
      state="approval-requested"
      requestMessage="Complete the CAPTCHA and submit the application."
      onApprove={mockOnApprove}
      onReject={mockOnReject}
    />
  );

  const rejectButton = getByRole('button', { name: /skip for now/i });
  await expect.element(rejectButton).toBeInTheDocument();

  const approveButton = getByRole('button', { name: /take control/i });
  await expect.element(approveButton).toBeInTheDocument();
});
