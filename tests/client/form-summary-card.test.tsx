import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { FormSummaryCard } from '@/components/ai-elements/form-summary-card';

const SECTIONS = [
  {
    id: 'identity',
    title: 'Identity & eligibility',
    fields: [
      { field: 'Full name', value: 'Rosa Martinez', source: 'database' as const },
      { field: 'SSN', value: '', source: 'missing' as const, required: true, inputType: 'text' as const },
    ],
  },
];

test('renders summary with Start review and Skip buttons', async () => {
  const { getByRole } = render(
    <FormSummaryCard formName="CalFresh" sections={SECTIONS} sendMessage={vi.fn()} />
  );
  await expect.element(getByRole('button', { name: /start review/i })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: /skip for now/i })).toBeInTheDocument();
});

test('Start review opens the editable modal at the first missing-required section', async () => {
  const { getByRole, getByText } = render(
    <FormSummaryCard formName="CalFresh" sections={SECTIONS} sendMessage={vi.fn()} />
  );
  await getByRole('button', { name: /start review/i }).click();
  await expect.element(getByText('Identity & eligibility')).toBeInTheDocument();
  await expect.element(getByRole('button', { name: /^submit$/i })).toBeInTheDocument();
});

test('artifact closed with data shows View responses', async () => {
  const { getByRole } = render(
    <FormSummaryCard
      formName="CalFresh"
      sections={SECTIONS}
      sendMessage={vi.fn()}
      isArtifactVisible={false}
    />
  );
  await expect.element(getByRole('button', { name: /view responses/i })).toBeInTheDocument();
});

test('View responses opens a read-only modal (no Submit button)', async () => {
  const { getByRole } = render(
    <FormSummaryCard
      formName="CalFresh"
      sections={SECTIONS}
      sendMessage={vi.fn()}
      isArtifactVisible={false}
    />
  );
  await getByRole('button', { name: /view responses/i }).click();
  // Submit button must not be present in read-only mode; Done is shown instead.
  await expect.element(getByRole('button', { name: /^submit$/i })).not.toBeInTheDocument();
  await expect.element(getByRole('button', { name: /^done$/i })).toBeInTheDocument();
});

test('Submit posts changed values back to sendMessage', async () => {
  const sendMessage = vi.fn();
  const { getByRole } = render(
    <FormSummaryCard formName="CalFresh" sections={SECTIONS} sendMessage={sendMessage} />
  );
  await getByRole('button', { name: /start review/i }).click();
  // The required-but-empty SSN row renders a text input; only one textbox in the modal.
  await getByRole('textbox').fill('123-45-6789');
  await getByRole('button', { name: /^submit$/i }).click();
  expect(sendMessage).toHaveBeenCalledTimes(1);
  const text = sendMessage.mock.calls[0][0].parts[0].text;
  expect(text).toContain('Please update the following form fields for CalFresh');
  expect(text).toContain('SSN: 123-45-6789');
});
