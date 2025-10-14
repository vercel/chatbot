import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { ConsentPage } from '@/components/consent-page';

test('ConsentPage renders with proper content', async () => {
  const mockOnConsent = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnNavigateHome = vi.fn();
  const { getByText } = render(<ConsentPage onConsent={mockOnConsent} onBack={mockOnBack} onNavigateHome={mockOnNavigateHome} />);

  await expect.element(getByText('Consent for Agentic AI')).toBeInTheDocument();
  await expect.element(getByText('This tool uses your personal data to submit for benefit applications using artificial intelligence (AI).')).toBeInTheDocument();
  await expect.element(getByText('Confirm choices')).toBeInTheDocument();
});

test('ConsentPage disables consent button when radio button is not selected', async () => {
  const mockOnConsent = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnNavigateHome = vi.fn();
  const { getByRole } = render(<ConsentPage onConsent={mockOnConsent} onBack={mockOnBack} onNavigateHome={mockOnNavigateHome} />);

  const consentButton = getByRole('button', { name: 'Confirm choices' });
  await expect.element(consentButton).toBeDisabled();
});

test('ConsentPage enables consent button when radio button is selected', async () => {
  const mockOnConsent = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnNavigateHome = vi.fn();
  const { getByRole, getByTestId } = render(<ConsentPage onConsent={mockOnConsent} onBack={mockOnBack} onNavigateHome={mockOnNavigateHome} />);

  const radioButton = getByTestId('consent-yes');
  const consentButton = getByRole('button', { name: 'Confirm choices' });

  await radioButton.click();
  await expect.element(consentButton).not.toBeDisabled();
});

test('ConsentPage calls onConsent when consent button is clicked after radio button is selected', async () => {
  const mockOnConsent = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnNavigateHome = vi.fn();
  const { getByRole, getByTestId } = render(<ConsentPage onConsent={mockOnConsent} onBack={mockOnBack} onNavigateHome={mockOnNavigateHome} />);

  const radioButton = getByTestId('consent-yes');
  const consentButton = getByRole('button', { name: 'Confirm choices' });

  await radioButton.click();
  await consentButton.click();

  expect(mockOnConsent).toHaveBeenCalledTimes(1);
});

test('ConsentPage shows modal when no consent is selected and confirm button is clicked', async () => {
  const mockOnConsent = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnNavigateHome = vi.fn();
  const { getByRole, getByTestId, getByText } = render(<ConsentPage onConsent={mockOnConsent} onBack={mockOnBack} onNavigateHome={mockOnNavigateHome} />);

  const radioButton = getByTestId('consent-no');
  const consentButton = getByRole('button', { name: 'Confirm choices' });

  await radioButton.click();
  await consentButton.click();

  // Check that ConsentModal content is rendered
  await expect.element(getByText('You will be redirected to the home screen')).toBeInTheDocument();
  await expect.element(getByText('Client consent is required to use the agentic submission tool.')).toBeInTheDocument();
  await expect.element(getByText('Cancel')).toBeInTheDocument();
  await expect.element(getByText('Continue')).toBeInTheDocument();
});
