import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { ExitWarningModal } from '@/components/exit-warning-modal';

test('ExitWarningModal renders with proper content when open', async () => {
  const mockOnOpenChange = vi.fn();
  const mockOnLeaveSession = vi.fn();
  const { getByText } = render(
    <ExitWarningModal
      open={true}
      onOpenChange={mockOnOpenChange}
      onLeaveSession={mockOnLeaveSession}
    />
  );

  await expect
    .element(getByText('Leave this application session?'))
    .toBeInTheDocument();
  await expect
    .element(
      getByText(
        /If you start a new application or open another one, your current session will end/i
      )
    )
    .toBeInTheDocument();
  await expect
    .element(
      getByText(
        /You'll be able to view it, but you won't be able to continue or submit the application/i
      )
    )
    .toBeInTheDocument();
  await expect.element(getByText('Cancel')).toBeInTheDocument();
  await expect.element(getByText('Leave session')).toBeInTheDocument();
});

test('ExitWarningModal does not render when closed', async () => {
  const mockOnOpenChange = vi.fn();
  const mockOnLeaveSession = vi.fn();
  const { container } = render(
    <ExitWarningModal
      open={false}
      onOpenChange={mockOnOpenChange}
      onLeaveSession={mockOnLeaveSession}
    />
  );

  expect(container.textContent).not.toContain(
    'Leave this application session?'
  );
});

test('ExitWarningModal cancel button calls onOpenChange with false', async () => {
  const mockOnOpenChange = vi.fn();
  const mockOnLeaveSession = vi.fn();
  const { getByRole } = render(
    <ExitWarningModal
      open={true}
      onOpenChange={mockOnOpenChange}
      onLeaveSession={mockOnLeaveSession}
    />
  );

  const cancelButton = getByRole('button', { name: 'Cancel' });
  await cancelButton.click();

  expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  expect(mockOnLeaveSession).not.toHaveBeenCalled();
});

test('ExitWarningModal leave session button calls onOpenChange with false and onLeaveSession', async () => {
  const mockOnOpenChange = vi.fn();
  const mockOnLeaveSession = vi.fn();
  const { getByRole } = render(
    <ExitWarningModal
      open={true}
      onOpenChange={mockOnOpenChange}
      onLeaveSession={mockOnLeaveSession}
    />
  );

  const leaveButton = getByRole('button', { name: 'Leave session' });
  await leaveButton.click();

  expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  expect(mockOnLeaveSession).toHaveBeenCalledTimes(1);
});

test('ExitWarningModal has proper accessibility attributes', async () => {
  const mockOnOpenChange = vi.fn();
  const mockOnLeaveSession = vi.fn();
  const { getByRole } = render(
    <ExitWarningModal
      open={true}
      onOpenChange={mockOnOpenChange}
      onLeaveSession={mockOnLeaveSession}
    />
  );

  const dialog = getByRole('alertdialog');
  await expect.element(dialog).toBeInTheDocument();

  const cancelButton = getByRole('button', { name: 'Cancel' });
  const leaveButton = getByRole('button', { name: 'Leave session' });

  await expect.element(cancelButton).toBeInTheDocument();
  await expect.element(leaveButton).toBeInTheDocument();
});

