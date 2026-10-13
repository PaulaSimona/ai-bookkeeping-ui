// InternalClientNoDocumentAccounts (Release C2 U7; backend Release C1,
// O-S88-4): a client's expense accounts, each with its "no document" mark.
// Staff mark or unmark an account; the mark on screen is always the one the
// server said — from its list, or from its answer to the mark — never the one
// that was asked for.
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { type NoDocumentAccount } from '@/hooks/useStaffNoDocumentAccounts';
import { InternalClientNoDocumentAccounts } from './InternalClientNoDocumentAccounts';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

type Params = Record<string, string | number | boolean>;
const get = api.get as unknown as Mock<
  (url: string, config?: { params?: Params }) => Promise<unknown>
>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const ORG = '11111111-1111-4111-8111-111111111111';
const URL = `/api/accounting/staff/orgs/${ORG}/no-document-accounts/`;

// The accounts as the server lists them: active expense accounts, by code.
const RENT: NoDocumentAccount = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  code: '5000',
  name: 'Rent Expense',
  no_document: false,
};
const FEES: NoDocumentAccount = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  code: '5700',
  name: 'Bank Charges',
  no_document: false,
};
const INTEREST: NoDocumentAccount = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  code: '5710',
  name: 'Interest Expense',
  no_document: true,
};

const MARKED = 'No document needed';
const UNMARKED = 'Document required';
const MARK = 'Mark as no-document';
const UNMARK = 'Remove mark';
const MARK_TITLE = 'Mark as a no-document account?';
const UNMARK_TITLE = 'Remove the no-document mark?';
const LIMIT = 'The hourly limit for this action has been reached. Try again later.';

const serve = (rows: NoDocumentAccount[] = [RENT, FEES, INTEREST], count?: number) => {
  get.mockImplementation((url) =>
    Promise.resolve(
      url === URL
        ? {
            status: 200,
            data: { count: count ?? rows.length, next: null, previous: null, results: rows },
          }
        : { status: 404, data: { detail: 'Not found.' } },
    ),
  );
};

const answered = (account: NoDocumentAccount, changed: boolean) => ({
  status: 200,
  data: { account, changed },
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/internal/clients/${ORG}/no-document-accounts`]}>
      <Routes>
        <Route
          path="/internal/clients/:orgId/no-document-accounts"
          element={<InternalClientNoDocumentAccounts />}
        />
      </Routes>
    </MemoryRouter>,
  );

// The list row of the account with this code, its cells, and its one button.
const rowOf = async (code: string) => (await screen.findByText(code)).closest('tr') as HTMLElement;
const cellsOf = (row: HTMLElement) =>
  within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
const markOf = async (code: string) => cellsOf(await rowOf(code))[2];
const buttonOf = async (code: string, name: string) =>
  within(await rowOf(code)).getByRole('button', { name });
const button = (name: string) => screen.getByRole('button', { name });
const listRequests = () => get.mock.calls.filter(([url]) => url === URL).map(([, config]) => config?.params);

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe("a client's no-document accounts", () => {
  it("lists the org's expense accounts by code and name, each with its mark", async () => {
    serve();
    renderPage();

    expect(cellsOf(await rowOf('5000'))).toEqual(['5000', 'Rent Expense', UNMARKED, MARK]);
    expect(cellsOf(await rowOf('5700'))).toEqual(['5700', 'Bank Charges', UNMARKED, MARK]);
    expect(cellsOf(await rowOf('5710'))).toEqual(['5710', 'Interest Expense', MARKED, UNMARK]);
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Code',
      'Account',
      'No document',
      'Action',
    ]);
    // In the server's order, under the server's count.
    expect(screen.getAllByRole('row').slice(1).map((tr) => cellsOf(tr)[0])).toEqual([
      '5000',
      '5700',
      '5710',
    ]);
    expect(screen.getByRole('heading', { name: 'Expense accounts (3)' })).toBeInTheDocument();
    expect(listRequests()).toEqual([{ page: 1, page_size: 50 }]);
    expect(post).not.toHaveBeenCalled();
  });

  it('shows the mark the server returned, and only once it has answered', async () => {
    const user = userEvent.setup();
    serve();
    const answers: ((value: unknown) => void)[] = [];
    post.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
    renderPage();

    await user.click(await buttonOf('5700', MARK));
    await user.click(button('Confirm'));
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(URL, { account_id: FEES.id, no_document: true });
    // The request is out and nothing has come back: the mark has not moved.
    expect(await markOf('5700')).toBe(UNMARKED);

    await act(async () => answers[0](answered({ ...FEES, no_document: true }, true)));
    expect(
      await screen.findByText('5700 Bank Charges is now a no-document account.'),
    ).toBeInTheDocument();
    expect(await markOf('5700')).toBe(MARKED);
    expect(await buttonOf('5700', UNMARK)).toBeEnabled();
    // The list was not read again: the mark came from the answer itself.
    expect(listRequests()).toHaveLength(1);

    // And it is the server's word that is shown, not the one that was asked
    // for: asked to mark 5000, the server answers that it is not marked.
    await user.click(await buttonOf('5000', MARK));
    await user.click(button('Confirm'));
    expect(post).toHaveBeenLastCalledWith(URL, { account_id: RENT.id, no_document: true });
    await act(async () => answers[1](answered({ ...RENT, no_document: false }, false)));
    await waitFor(() => expect(screen.queryByRole('heading', { name: MARK_TITLE })).not.toBeInTheDocument());
    expect(await markOf('5000')).toBe(UNMARKED);
    expect(await buttonOf('5000', MARK)).toBeEnabled();
    expect(screen.queryByText('5000 Rent Expense is now a no-document account.')).not.toBeInTheDocument();
  });

  it('unmarks a marked account the same way', async () => {
    const user = userEvent.setup();
    serve();
    post.mockResolvedValue(answered({ ...INTEREST, no_document: false }, true));
    renderPage();

    await user.click(await buttonOf('5710', UNMARK));
    expect(await screen.findByRole('heading', { name: UNMARK_TITLE })).toBeInTheDocument();
    await user.click(button('Confirm'));

    expect(
      await screen.findByText('5710 Interest Expense is no longer a no-document account.'),
    ).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(URL, { account_id: INTEREST.id, no_document: false });
    expect(await markOf('5710')).toBe(UNMARKED);
    expect(await buttonOf('5710', MARK)).toBeEnabled();
  });

  it('says nothing changed when the server says so', async () => {
    const user = userEvent.setup();
    serve();
    // Someone else marked it in the meantime: it is marked, and nothing changed.
    post.mockResolvedValue(answered({ ...FEES, no_document: true }, false));
    renderPage();

    await user.click(await buttonOf('5700', MARK));
    await user.click(button('Confirm'));

    expect(
      await screen.findByText('Nothing changed: 5700 Bank Charges was already marked.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('5700 Bank Charges is now a no-document account.')).not.toBeInTheDocument();
    // The row shows how the account stands, as the server said.
    expect(await markOf('5700')).toBe(MARKED);
  });

  it('leaves the mark as it was when the server refuses, and shows its code and words', async () => {
    const user = userEvent.setup();
    serve();
    const detail = 'This account is inactive.';
    post.mockResolvedValue({ status: 409, data: { code: 'account_inactive', detail } });
    renderPage();

    await user.click(await buttonOf('5700', MARK));
    await user.click(button('Confirm'));

    const refusal = await screen.findByRole('alert');
    expect(refusal).toHaveTextContent(detail);
    expect(within(refusal).getByText('account_inactive')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: MARK_TITLE })).not.toBeInTheDocument();
    expect(await markOf('5700')).toBe(UNMARKED);
    expect(screen.queryByText('5700 Bank Charges is now a no-document account.')).not.toBeInTheDocument();
    expect(listRequests()).toHaveLength(1);
  });

  it('says the account is no longer available on a 404, with a refresh', async () => {
    const user = userEvent.setup();
    serve();
    post.mockResolvedValue({ status: 404, data: { detail: 'Not found.' } });
    renderPage();

    await user.click(await buttonOf('5700', MARK));
    await user.click(button('Confirm'));
    expect(await screen.findByText('This account is no longer available.')).toBeInTheDocument();
    expect(await markOf('5700')).toBe(UNMARKED);
    expect(listRequests()).toHaveLength(1);

    // Refresh reads the list again.
    serve([RENT, INTEREST]);
    await user.click(button('Refresh'));
    await waitFor(() => expect(listRequests()).toHaveLength(2));
    await waitFor(() => expect(screen.queryByText('5700')).not.toBeInTheDocument());
    expect(screen.queryByText('This account is no longer available.')).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('shows the hourly limit on a 429 and does not try again by itself', async () => {
    const user = userEvent.setup();
    serve();
    post.mockResolvedValue({ status: 429, data: { detail: 'Request was throttled.' } });
    renderPage();

    await user.click(await buttonOf('5700', MARK));
    await user.click(button('Confirm'));

    expect(await screen.findByText(LIMIT)).toBeInTheDocument();
    expect(await markOf('5700')).toBe(UNMARKED);
    expect(post).toHaveBeenCalledTimes(1);
    expect(listRequests()).toHaveLength(1);
    // Asking again is the staff member's own choice.
    expect(await buttonOf('5700', MARK)).toBeEnabled();
  });

  it('leaves the mark as it was when the connection is lost', async () => {
    const user = userEvent.setup();
    serve();
    post.mockRejectedValue(new Error('network down'));
    renderPage();

    await user.click(await buttonOf('5710', UNMARK));
    await user.click(button('Confirm'));

    const failure = await screen.findByRole('alert');
    expect(failure.textContent).toBe('Could not remove the mark.');
    expect(await markOf('5710')).toBe(MARKED);
    expect(screen.queryByText('5710 Interest Expense is no longer a no-document account.')).not.toBeInTheDocument();
    expect(await buttonOf('5710', UNMARK)).toBeEnabled();
  });

  it('sends one request at a time: nothing else can be marked while one is in flight', async () => {
    const user = userEvent.setup();
    serve();
    const answers: ((value: unknown) => void)[] = [];
    post.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
    renderPage();

    await user.click(await buttonOf('5700', MARK));
    await user.click(button('Confirm'));

    // The request is out: it cannot be sent twice, nor cancelled half way,
    // and no other account can be marked or unmarked meanwhile.
    expect(button('Confirm')).toBeDisabled();
    expect(button('Cancel')).toBeDisabled();
    expect(await buttonOf('5000', MARK)).toBeDisabled();
    expect(await buttonOf('5710', UNMARK)).toBeDisabled();
    await user.click(button('Confirm'));
    await user.click(await buttonOf('5710', UNMARK));
    expect(post).toHaveBeenCalledTimes(1);

    await act(async () => answers[0](answered({ ...FEES, no_document: true }, true)));
    expect(
      await screen.findByText('5700 Bank Charges is now a no-document account.'),
    ).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(await buttonOf('5710', UNMARK)).toBeEnabled();
  });

  it('asks before it marks or unmarks, naming the account', async () => {
    const user = userEvent.setup();
    serve();
    renderPage();

    await user.click(await buttonOf('5700', MARK));
    const marking = (await screen.findByRole('heading', { name: MARK_TITLE })).closest(
      'div.rounded-2xl',
    ) as HTMLElement;
    expect(marking).toHaveTextContent('5700 Bank Charges');
    // Looking sends nothing, and Cancel sends nothing.
    expect(post).not.toHaveBeenCalled();
    await user.click(button('Cancel'));
    expect(screen.queryByRole('heading', { name: MARK_TITLE })).not.toBeInTheDocument();

    await user.click(await buttonOf('5710', UNMARK));
    const unmarking = (await screen.findByRole('heading', { name: UNMARK_TITLE })).closest(
      'div.rounded-2xl',
    ) as HTMLElement;
    expect(unmarking).toHaveTextContent('5710 Interest Expense');
    await user.click(button('Cancel'));
    expect(screen.queryByRole('heading', { name: UNMARK_TITLE })).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    expect(await markOf('5700')).toBe(UNMARKED);
    expect(await markOf('5710')).toBe(MARKED);
  });

  it('pages through a long chart fifty accounts at a time', async () => {
    const user = userEvent.setup();
    serve([RENT, FEES, INTEREST], 120);
    renderPage();
    await rowOf('5000');

    expect(screen.getByRole('heading', { name: 'Expense accounts (120)' })).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(button('Previous')).toBeDisabled();

    await user.click(button('Next'));
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
    expect(listRequests().at(-1)).toEqual({ page: 2, page_size: 50 });
  });

  it('says so when the org has no expense accounts', async () => {
    serve([]);
    renderPage();

    expect(await screen.findByText('No expense accounts')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows why the list could not be read, and reads it again on Retry', async () => {
    const user = userEvent.setup();
    const detail = 'Request was throttled. Expected available in 30 seconds.';
    get.mockResolvedValue({ status: 429, data: { detail } });
    renderPage();

    expect(await screen.findByText(detail)).toBeInTheDocument();
    expect(screen.queryByText('No expense accounts')).not.toBeInTheDocument();

    serve();
    await user.click(button('Retry'));
    expect(await screen.findByText('5700')).toBeInTheDocument();
    expect(screen.queryByText(detail)).not.toBeInTheDocument();
  });
});
