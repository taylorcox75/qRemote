// serverFormHarness.tsx — shared stubs, helpers and behaviour tests for the
// two near-duplicate server forms (app/server/add.tsx and app/server/[id].tsx).
// AGENTS.md notes a change to one form must be made in both; running the same
// validation / test-connection / debug-panel assertions against each screen is
// what catches the two drifting apart.
//
// Child components with their own suites (QuiProxyUrlField, the custom-header
// and appearance sections, OptionPicker, SuperDebugPanel) are replaced by
// minimal stubs so these tests assert on what the SCREEN does with their
// callbacks — the ServerConfig it builds and the API calls it makes.
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

/* ───────────────────────────── i18n stand-in ───────────────────────────── */

/** `key` alone, or `key(v1,v2)` when interpolation values are passed. */
export const translate = (key: string, opts?: Record<string, unknown>): string => {
  const values = Object.entries(opts ?? {})
    .filter(([k]) => k !== 'lng' && k !== 'defaultValue')
    .map(([, v]) => String(v));
  return values.length > 0 ? `${key}(${values.join(',')})` : key;
};

/* ───────────────────────────── component stubs ─────────────────────────── */

export function QuiProxyUrlFieldStub(props: {
  value: string;
  onChangeText: (v: string) => void;
  hint?: string;
}) {
  return (
    <TextInput
      testID={props.hint ? 'qui-url-fallback' : 'qui-url'}
      value={props.value}
      onChangeText={props.onChangeText}
    />
  );
}

type HeaderPair = { key: string; value: string };
export function CustomHeadersSectionStub(props: {
  useCustomHeaders: boolean;
  headers: HeaderPair[];
  onUseCustomHeadersChange: (v: boolean) => void;
  onHeadersChange: (h: HeaderPair[]) => void;
}) {
  return (
    <View>
      <Text testID="headers-state">
        {`${props.useCustomHeaders ? 'on' : 'off'}:${props.headers.map((h) => h.key).join(',')}`}
      </Text>
      <Pressable
        testID="headers-toggle"
        onPress={() => props.onUseCustomHeadersChange(!props.useCustomHeaders)}
      />
      <Pressable
        testID="headers-valid"
        onPress={() =>
          props.onHeadersChange([
            { key: ' X-Token ', value: ' secret ' },
            { key: '', value: '' },
          ])
        }
      />
      <Pressable
        testID="headers-reserved"
        onPress={() => props.onHeadersChange([{ key: 'Cookie', value: 'a=b' }])}
      />
      <Pressable
        testID="headers-incomplete"
        onPress={() => props.onHeadersChange([{ key: 'X-Token', value: '' }])}
      />
    </View>
  );
}

export function ServerAppearanceSectionStub(props: {
  icon: string;
  iconColor: string;
  onIconChange: (v: string) => void;
  onIconColorChange: (v: string) => void;
}) {
  return (
    <View>
      <Text testID="appearance-state">{`${props.icon}|${props.iconColor}`}</Text>
      <Pressable testID="appearance-icon" onPress={() => props.onIconChange('cloud-outline')} />
      <Pressable testID="appearance-color" onPress={() => props.onIconColorChange('#FF0000')} />
    </View>
  );
}

export function OptionPickerStub(props: {
  visible: boolean;
  options: { label: string; value: string }[];
  selectedValue?: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  if (!props.visible) return null;
  return (
    <View testID="option-picker">
      {props.options.map((o) => (
        <Pressable
          key={o.value}
          testID={`option-${o.value}`}
          onPress={() => props.onSelect(o.value)}
        >
          <Text>{o.label}</Text>
        </Pressable>
      ))}
      <Pressable testID="option-close" onPress={props.onClose} />
    </View>
  );
}

export function SettingRowStub(props: { label: string; children?: React.ReactNode }) {
  return (
    <View testID={`row-${props.label}`}>
      <Text>{props.label}</Text>
      {props.children}
    </View>
  );
}

export function SuperDebugPanelStub(props: {
  host: string;
  port: string;
  basePath?: string;
  useQuiProxy?: boolean;
  bypassAuth?: boolean;
  useApiKey?: boolean;
}) {
  return (
    <Text testID="super-debug">
      {[
        props.host,
        props.port,
        props.basePath ?? '-',
        props.useQuiProxy ? 'qui' : 'noqui',
        props.bypassAuth ? 'none' : props.useApiKey ? 'apikey' : 'auth',
      ].join('|')}
    </Text>
  );
}

/* ──────────────────────────────── helpers ──────────────────────────────── */

export const QUI_KEY = '0123456789abcdef0123456789abcdef';

export const type = (placeholder: string, text: string) =>
  fireEvent.changeText(screen.getByPlaceholderText(placeholder), text);

export const switchFor = (label: string) =>
  within(screen.getByTestId(`row-${label}`)).getByRole('switch');

export const toggle = (label: string, value: boolean) =>
  fireEvent(switchFor(label), 'valueChange', value);

export const pressSave = () => fireEvent.press(screen.getByText('common.save'));
export const pressTest = () => fireEvent.press(screen.getByText('server.testConnection'));

export async function chooseAuthMode(mode: 'password' | 'apiKey' | 'none' | 'quiProxy') {
  await fireEvent.press(screen.getByText('server.authMethod'));
  await fireEvent.press(screen.getByTestId(`option-${mode}`));
}

export async function fillPasswordServer(
  opts: { name?: string; host?: string; port?: string } = {},
) {
  await type('placeholders.serverName', opts.name ?? 'Home');
  await type('placeholders.ipDomain', opts.host ?? 'nas.example.com');
  if (opts.port !== undefined) await type('placeholders.portOptional', opts.port);
  await type('placeholders.username', 'admin');
  await type('placeholders.password', 'hunter2');
}

/* ─────────────────────────── shared behaviour tests ────────────────────── */

export interface SharedFormDeps {
  /** Renders the screen and resolves once the (blank) form is interactive. */
  renderForm: () => Promise<void>;
  showToast: jest.Mock;
  saveServer: jest.Mock;
  testConnection: jest.Mock;
  setClipboard: jest.Mock;
  setCertAvailable: (available: boolean) => void;
}

export function describeSharedServerForm(title: string, deps: SharedFormDeps) {
  const { renderForm, showToast, saveServer, testConnection } = deps;
  const lastToast = () => showToast.mock.calls[showToast.mock.calls.length - 1];

  describe(`${title} — validation (shared by save and test)`, () => {
    it.each([
      ['save', pressSave],
      ['test', pressTest],
    ])('requires a name and host before %s', async (_label, press) => {
      await renderForm();
      await press();
      expect(lastToast()).toEqual(['errors.fillNameAndHost', 'error']);
      expect(saveServer).not.toHaveBeenCalled();
      expect(testConnection).not.toHaveBeenCalled();
    });

    it.each([
      ['save', pressSave],
      ['test', pressTest],
    ])('requires a username and password in password mode (%s)', async (_label, press) => {
      await renderForm();
      await type('placeholders.serverName', 'Home');
      await type('placeholders.ipDomain', 'nas.example.com');
      await press();
      expect(lastToast()).toEqual(['errors.fillUsernamePassword', 'error']);
    });

    it.each([
      ['save', pressSave],
      ['test', pressTest],
    ])('rejects an out-of-range port (%s)', async (_label, press) => {
      await renderForm();
      await fillPasswordServer({ port: '70000' });
      await press();
      expect(lastToast()).toEqual(['errors.validPort', 'error']);
    });

    it.each([
      ['save', pressSave],
      ['test', pressTest],
    ])('requires a proxy username once Basic Auth is on (%s)', async (_label, press) => {
      await renderForm();
      await fillPasswordServer();
      await toggle('server.useBasicAuth', true);
      await press();
      expect(lastToast()).toEqual(['errors.fillBasicAuthUsername', 'error']);
    });

    it.each([
      ['save', pressSave],
      ['test', pressTest],
    ])('rejects reserved and incomplete custom headers (%s)', async (_label, press) => {
      await renderForm();
      await fillPasswordServer();
      await fireEvent.press(screen.getByTestId('headers-toggle'));
      await fireEvent.press(screen.getByTestId('headers-reserved'));
      await press();
      expect(lastToast()).toEqual(['errors.reservedHeaderName(Cookie)', 'error']);
      await fireEvent.press(screen.getByTestId('headers-incomplete'));
      await press();
      expect(lastToast()).toEqual(['errors.fillCustomHeaderFields', 'error']);
    });

    it.each([
      ['save', pressSave],
      ['test', pressTest],
    ])('validates the fallback host and port (%s)', async (_label, press) => {
      await renderForm();
      await fillPasswordServer();
      await toggle('server.useFallback', true);
      await press();
      expect(lastToast()).toEqual(['errors.fillFallbackHost', 'error']);
      await type('placeholders.fallbackHost', 'vpn.example.com');
      // Both port fields share a placeholder; the second is the fallback's.
      await fireEvent.changeText(
        screen.getAllByPlaceholderText('placeholders.portOptional')[1],
        '0',
      );
      await press();
      expect(lastToast()).toEqual(['errors.validPort', 'error']);
    });

    it.each([
      ['save', pressSave],
      ['test', pressTest],
    ])('requires an API key in API-key mode (%s)', async (_label, press) => {
      await renderForm();
      await type('placeholders.serverName', 'Home');
      await type('placeholders.ipDomain', 'nas.example.com');
      await chooseAuthMode('apiKey');
      // Username/password fields are gone and proxy Basic Auth is replaced by a note.
      expect(screen.queryByPlaceholderText('placeholders.username')).toBeNull();
      expect(screen.getByText('server.apiKeyProxyConflict')).toBeTruthy();
      expect(screen.getByText('server.authMethodApiKey')).toBeTruthy();
      await press();
      expect(lastToast()).toEqual(['errors.fillApiKey', 'error']);
    });

    it.each([
      ['save', pressSave],
      ['test', pressTest],
    ])('rejects an unparseable qui proxy URL (%s)', async (_label, press) => {
      await renderForm();
      await type('placeholders.serverName', 'Home');
      await chooseAuthMode('quiProxy');
      expect(screen.queryByPlaceholderText('placeholders.ipDomain')).toBeNull();
      await fireEvent.changeText(screen.getByTestId('qui-url'), 'ftp://nope');
      await press();
      expect(lastToast()).toEqual(['errors.invalidQuiProxyUrl', 'error']);
    });

    it.each([
      ['save', pressSave],
      ['test', pressTest],
    ])('requires a valid qui fallback URL when the fallback is on (%s)', async (_label, press) => {
      await renderForm();
      await type('placeholders.serverName', 'Home');
      await chooseAuthMode('quiProxy');
      await fireEvent.changeText(
        screen.getByTestId('qui-url'),
        `https://qui.example.com/proxy/${QUI_KEY}`,
      );
      await toggle('server.useFallback', true);
      await fireEvent.changeText(screen.getByTestId('qui-url-fallback'), 'not a url');
      await press();
      expect(lastToast()).toEqual(['errors.invalidQuiFallbackUrl', 'error']);
    });
  });

  describe(`${title} — qui URL pasted into Host`, () => {
    it('switches to qui Proxy mode and moves the URL into the qui field', async () => {
      await renderForm();
      await type('placeholders.ipDomain', `qui.local:7476/proxy/${QUI_KEY}`);
      expect(showToast).toHaveBeenCalledWith('toast.quiProxyUrlDetected', 'info');
      expect(screen.getByTestId('qui-url').props.value).toBe(
        `http://qui.local:7476/proxy/${QUI_KEY}`,
      );
      expect(screen.queryByPlaceholderText('placeholders.ipDomain')).toBeNull();
    });

    it('leaves an ordinary host alone', async () => {
      await renderForm();
      await type('placeholders.ipDomain', 'qui.local/proxy/short');
      expect(showToast).not.toHaveBeenCalledWith('toast.quiProxyUrlDetected', 'info');
      expect(screen.getByPlaceholderText('placeholders.ipDomain').props.value).toBe(
        'qui.local/proxy/short',
      );
    });
  });

  describe(`${title} — test connection`, () => {
    it('tests an isolated config built from the form and reports success', async () => {
      testConnection.mockResolvedValue({ success: true });
      await renderForm();
      await fillPasswordServer({ host: 'https://nas.example.com/', port: '8080' });
      await toggle('server.useHttps', true);
      await pressTest();
      await waitFor(() =>
        expect(showToast).toHaveBeenCalledWith('toast.connectionTestSuccess', 'success'),
      );
      const [server, signal] = testConnection.mock.calls[0];
      expect(server).toEqual(
        expect.objectContaining({
          name: 'Home',
          host: 'nas.example.com',
          port: 8080,
          username: 'admin',
          password: 'hunter2',
          useHttps: true,
          useFallback: false,
        }),
      );
      expect(signal).toBeInstanceOf(AbortSignal);
    });

    it('shows the localized server error, or a generic one when none is given', async () => {
      await renderForm();
      await fillPasswordServer();
      testConnection.mockResolvedValueOnce({ success: false, error: 'Bad credentials' });
      await pressTest();
      await waitFor(() => expect(lastToast()).toEqual(['Bad credentials', 'error']));
      testConnection.mockResolvedValueOnce({ success: false });
      await pressTest();
      await waitFor(() => expect(lastToast()).toEqual(['errors.connectionTestFailed', 'error']));
    });

    it('summarises primary and fallback results separately', async () => {
      testConnection.mockResolvedValue({
        success: true,
        primary: { success: false },
        fallback: { success: true },
      });
      await renderForm();
      await fillPasswordServer();
      await toggle('server.useFallback', true);
      await type('placeholders.fallbackHost', 'http://vpn.example.com');
      await pressTest();
      await waitFor(() =>
        expect(lastToast()).toEqual([
          'server.testEndpointFail(server.endpointPrimary) · server.testEndpointOk(server.endpointFallback)',
          'success',
        ]),
      );
      expect(testConnection.mock.calls[0][0]).toEqual(
        expect.objectContaining({ useFallback: true, fallbackHost: 'vpn.example.com' }),
      );
    });

    it('reports a thrown error but stays quiet for a cancellation', async () => {
      await renderForm();
      await fillPasswordServer();
      testConnection.mockRejectedValueOnce(new Error('Network Error'));
      await pressTest();
      await waitFor(() => expect(lastToast()).toEqual(['Network Error', 'error']));

      showToast.mockClear();
      const abort = new Error('aborted');
      abort.name = 'AbortError';
      testConnection.mockRejectedValueOnce(abort);
      await pressTest();
      await waitFor(() => expect(screen.getByText('server.testConnection')).toBeTruthy());
      expect(showToast).not.toHaveBeenCalled();
    });

    it('can cancel a running test, aborting its signal', async () => {
      let signal: AbortSignal | undefined;
      testConnection.mockImplementation((_s: unknown, sig: AbortSignal) => {
        signal = sig;
        return new Promise(() => {});
      });
      await renderForm();
      await fillPasswordServer();
      // Not awaited: the handler's promise never settles in this test.
      void pressTest();
      expect(await screen.findByText('server.testingConnection')).toBeTruthy();
      // The header's Cancel is first; the test card's Cancel is second.
      const cancels = screen.getAllByText('common.cancel');
      await fireEvent.press(cancels[cancels.length - 1]);
      expect(signal?.aborted).toBe(true);
      expect(screen.getByText('server.testConnection')).toBeTruthy();
    });

    it('tests a qui proxy endpoint with the key and base path from the URL', async () => {
      testConnection.mockResolvedValue({ success: true });
      await renderForm();
      await type('placeholders.serverName', 'qui');
      await chooseAuthMode('quiProxy');
      await fireEvent.changeText(
        screen.getByTestId('qui-url'),
        `https://qui.example.com:8443/qui/proxy/${QUI_KEY}`,
      );
      await pressTest();
      await waitFor(() => expect(testConnection).toHaveBeenCalled());
      expect(testConnection.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          host: 'qui.example.com',
          port: 8443,
          useHttps: true,
          basePath: '/qui',
          useQuiProxy: true,
          quiProxyKey: QUI_KEY,
          username: '',
          password: '',
        }),
      );
    });
  });

  describe(`${title} — debug panel`, () => {
    it('lists configuration warnings and copies a report without secrets', async () => {
      deps.setClipboard.mockResolvedValue(undefined);
      await renderForm();
      await type('placeholders.serverName', 'Local');
      await type('placeholders.ipDomain', 'http://localhost:8080/qbt');
      await fireEvent.press(screen.getByTestId('headers-toggle'));
      await fireEvent.press(screen.getByTestId('headers-valid'));
      await toggle('screens.settings.debugMode', true);

      expect(screen.getByText('server.warnProtocolRemoved(http://)')).toBeTruthy();
      expect(screen.getByText('server.warnLocalhost')).toBeTruthy();
      expect(screen.getByText('server.warnPortInHost(8080)')).toBeTruthy();
      expect(screen.getByText('server.warnCredentialsRequired')).toBeTruthy();
      expect(screen.getByText('server.debugCustomHeadersValue(X-Token)')).toBeTruthy();

      await fireEvent.press(screen.getByLabelText('server.copyDebugInfo'));
      await waitFor(() => expect(lastToast()).toEqual(['toast.debugCopied', 'success']));
      const report: string = deps.setClipboard.mock.calls[0][0];
      expect(report).toContain('Auth Method: password');
      expect(report).toContain('Custom Headers: X-Token (values hidden)');
      expect(report).toContain('[ERROR] server.warnLocalhost');
      expect(report).not.toContain('secret');
    });

    it('flags a bare IP without a port and HTTPS on a private address', async () => {
      await renderForm();
      await fillPasswordServer({ host: '192.168.1.20' });
      await toggle('server.useHttps', true);
      await toggle('screens.settings.debugMode', true);
      expect(screen.getByText('server.warnIpNoPort')).toBeTruthy();
      expect(screen.getByText('server.warnHttpsLocalIp')).toBeTruthy();
      expect(screen.getByTestId('super-debug')).toHaveTextContent('192.168.1.20||-|noqui|auth');
    });

    it('notes a dynamic-DNS host without a port and shows OK for a clean config', async () => {
      await renderForm();
      await fillPasswordServer({ host: 'me.duckdns.org' });
      await toggle('screens.settings.debugMode', true);
      expect(screen.getByText('server.warnDdnsNoPort')).toBeTruthy();
      await type('placeholders.portOptional', '8080');
      expect(screen.getByText('server.debugConfigOk')).toBeTruthy();
    });

    it('reports a missing API key / qui URL and masks the qui key', async () => {
      deps.setClipboard.mockResolvedValue(undefined);
      await renderForm();
      await chooseAuthMode('apiKey');
      await toggle('screens.settings.debugMode', true);
      expect(screen.getByText('server.warnApiKeyRequired')).toBeTruthy();

      await chooseAuthMode('quiProxy');
      expect(screen.getByText('server.warnQuiUrlRequired')).toBeTruthy();
      await fireEvent.changeText(
        screen.getByTestId('qui-url'),
        `https://qui.example.com/proxy/${QUI_KEY}`,
      );
      expect(screen.getByTestId('super-debug')).toHaveTextContent(
        `qui.example.com||/proxy/${QUI_KEY}|qui|auth`,
      );
      await fireEvent.press(screen.getByLabelText('server.copyDebugInfo'));
      await waitFor(() => expect(deps.setClipboard).toHaveBeenCalled());
      expect(deps.setClipboard.mock.calls[0][0]).not.toContain(QUI_KEY);
    });

    it('shows an error toast when copying fails', async () => {
      deps.setClipboard.mockRejectedValue(new Error('denied'));
      await renderForm();
      await chooseAuthMode('none');
      await toggle('screens.settings.debugMode', true);
      expect(screen.getByTestId('super-debug')).toHaveTextContent(/\|none$/);
      await fireEvent.press(screen.getByLabelText('server.copyDebugInfo'));
      await waitFor(() => expect(lastToast()).toEqual(['errors.failedToCopyDebug', 'error']));
    });
  });

  describe(`${title} — security and help`, () => {
    it('offers the self-signed opt-in only for HTTPS, with a hint when unavailable', async () => {
      deps.setCertAvailable(false);
      await renderForm();
      expect(screen.queryByTestId('row-server.allowInsecureCert')).toBeNull();
      await toggle('server.useHttps', true);
      expect(screen.getByTestId('row-server.allowInsecureCert')).toBeTruthy();
      expect(screen.getByText('server.allowInsecureCertUnavailable')).toBeTruthy();
    });

    it('hides the unavailable hint when the native allowlist is present', async () => {
      deps.setCertAvailable(true);
      await renderForm();
      await toggle('server.useHttps', true);
      expect(screen.queryByText('server.allowInsecureCertUnavailable')).toBeNull();
    });

    it('opens and closes the host and port help', async () => {
      await renderForm();
      const [hostInfo, portInfo] = screen.getAllByLabelText('common.moreInfo');
      await fireEvent.press(hostInfo);
      expect(screen.getByText('server.hostTooltipText')).toBeTruthy();
      await fireEvent.press(screen.getByText('server.gotIt'));
      expect(screen.queryByText('server.hostTooltipText')).toBeNull();
      await fireEvent.press(portInfo);
      expect(screen.getByText('server.portTooltipText')).toBeTruthy();
      await fireEvent.press(screen.getByText('server.gotIt'));
      expect(screen.queryByText('server.portTooltipText')).toBeNull();
    });

    it('dismisses the help by tapping the backdrop or the system back gesture', async () => {
      await renderForm();
      const [hostInfo, portInfo] = screen.getAllByLabelText('common.moreInfo');
      // Text inside the card has no handler of its own, so the tap reaches the backdrop.
      await fireEvent.press(hostInfo);
      await fireEvent.press(screen.getByText('server.hostTooltipText'));
      expect(screen.queryByText('server.hostTooltipText')).toBeNull();
      await fireEvent.press(portInfo);
      await fireEvent.press(screen.getByText('server.portTooltipText'));
      expect(screen.queryByText('server.portTooltipText')).toBeNull();

      for (const [button, text] of [
        [hostInfo, 'server.hostTooltipText'],
        [portInfo, 'server.portTooltipText'],
      ] as const) {
        await fireEvent.press(button);
        type TreeNode = { props: Record<string, unknown>; parent: TreeNode | null };
        let node = screen.getByText(text) as unknown as TreeNode | null;
        while (node && typeof node.props.onRequestClose !== 'function') {
          node = node.parent;
        }
        await fireEvent(node as unknown as Parameters<typeof fireEvent>[0], 'requestClose');
        expect(screen.queryByText(text)).toBeNull();
      }
    });

    it('closes the auth method picker without changing the mode', async () => {
      await renderForm();
      await fireEvent.press(screen.getByText('server.authMethod'));
      await fireEvent.press(screen.getByTestId('option-close'));
      expect(screen.queryByTestId('option-picker')).toBeNull();
      expect(screen.getByText('server.authMethodPassword')).toBeTruthy();
    });
  });
}
