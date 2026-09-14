import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { SplitLayout } from '@/components/shell/SplitLayout';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('SplitLayout', () => {
  it('renders the sidebar and content', async () => {
    await render(
      <SplitLayout sidebar={<Text>sidebar-content</Text>}>
        <Text>main-content</Text>
      </SplitLayout>,
    );
    expect(screen.getByText('sidebar-content')).toBeTruthy();
    expect(screen.getByText('main-content')).toBeTruthy();
  });

  it('hides the detail pane when absent', async () => {
    await render(
      <SplitLayout sidebar={<Text>sidebar-content</Text>}>
        <Text>main-content</Text>
      </SplitLayout>,
    );
    expect(screen.queryByTestId('split-layout-detail')).toBeNull();
  });

  it('renders the detail pane when provided', async () => {
    await render(
      <SplitLayout sidebar={<Text>sidebar-content</Text>} detail={<Text>detail-content</Text>}>
        <Text>main-content</Text>
      </SplitLayout>,
    );
    expect(screen.getByText('detail-content')).toBeTruthy();
  });

  it('applies the default sidebar and detail widths', async () => {
    await render(
      <SplitLayout sidebar={<Text>sidebar-content</Text>} detail={<Text>detail-content</Text>}>
        <Text>main-content</Text>
      </SplitLayout>,
    );
    const sidebar = StyleSheet.flatten(screen.getByTestId('split-layout-sidebar').props.style);
    const detail = StyleSheet.flatten(screen.getByTestId('split-layout-detail').props.style);
    expect(sidebar.width).toBe(240);
    expect(detail.width).toBe(380);
  });

  it('applies custom sidebar and detail widths', async () => {
    await render(
      <SplitLayout
        sidebar={<Text>sidebar-content</Text>}
        detail={<Text>detail-content</Text>}
        sidebarWidth={300}
        detailWidth={420}
      >
        <Text>main-content</Text>
      </SplitLayout>,
    );
    const sidebar = StyleSheet.flatten(screen.getByTestId('split-layout-sidebar').props.style);
    const detail = StyleSheet.flatten(screen.getByTestId('split-layout-detail').props.style);
    expect(sidebar.width).toBe(300);
    expect(detail.width).toBe(420);
  });

  it('collapses the sidebar to width 0 and hides its content', async () => {
    await render(
      <SplitLayout sidebar={<Text>sidebar-content</Text>} sidebarCollapsed>
        <Text>main-content</Text>
      </SplitLayout>,
    );
    const sidebar = StyleSheet.flatten(screen.getByTestId('split-layout-sidebar').props.style);
    expect(sidebar.width).toBe(0);
    expect(screen.queryByText('sidebar-content')).toBeNull();
  });

  it('shows an expand control when collapsed and onExpandSidebar is set', async () => {
    const onExpandSidebar = jest.fn();
    await render(
      <SplitLayout
        sidebar={<Text>sidebar-content</Text>}
        sidebarCollapsed
        onExpandSidebar={onExpandSidebar}
      >
        <Text>main-content</Text>
      </SplitLayout>,
    );
    fireEvent.press(screen.getByTestId('split-layout-expand'));
    expect(onExpandSidebar).toHaveBeenCalledTimes(1);
  });
});
