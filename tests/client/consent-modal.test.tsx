import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { ConsentModal } from '@/components/consent-modal';

test('ConsentModal renders with proper content when open', async () => {
  const mockOnOpenChange = vi.fn();
  const mockOnContinue = vi.fn();
  const { getByText } = render(
    <ConsentModal 
      open={true} 
      onOpenChange={mockOnOpenChange} 
      onContinue={mockOnContinue} 
    />
  );

  await expect.element(getByText('You will be redirected to the home screen')).toBeInTheDocument();
  await expect.element(getByText('Client consent is required to use the agentic submission tool.')).toBeInTheDocument();
  await expect.element(getByText('Cancel')).toBeInTheDocument();
  await expect.element(getByText('Continue')).toBeInTheDocument();
});

test('ConsentModal does not render when closed', async () => {
  const mockOnOpenChange = vi.fn();
  const mockOnContinue = vi.fn();
  const { queryByText } = render(
    <ConsentModal 
      open={false} 
      onOpenChange={mockOnOpenChange} 
      onContinue={mockOnContinue} 
    />
  );

  await expect.element(queryByText('You will be redirected to the home screen')).not.toBeInTheDocument();
});

test('ConsentModal cancel button calls onOpenChange with false', async () => {
  const mockOnOpenChange = vi.fn();
  const mockOnContinue = vi.fn();
  const { getByRole } = render(
    <ConsentModal 
      open={true} 
      onOpenChange={mockOnOpenChange} 
      onContinue={mockOnContinue} 
    />
  );

  const cancelButton = getByRole('button', { name: 'Cancel' });
  await cancelButton.click();

  expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  expect(mockOnContinue).not.toHaveBeenCalled();
});

test('ConsentModal continue button calls onOpenChange with false and onContinue', async () => {
  const mockOnOpenChange = vi.fn();
  const mockOnContinue = vi.fn();
  const { getByRole } = render(
    <ConsentModal 
      open={true} 
      onOpenChange={mockOnOpenChange} 
      onContinue={mockOnContinue} 
    />
  );

  const continueButton = getByRole('button', { name: 'Continue' });
  await continueButton.click();

  expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  expect(mockOnContinue).toHaveBeenCalledTimes(1);
});
