import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      currentScreen: 'chatList',
      showInfoPanel: false,
      theme: 'dark',
    });
  });

  it('has correct initial state', () => {
    const state = useUIStore.getState();
    expect(state.currentScreen).toBe('chatList');
    expect(state.showInfoPanel).toBe(false);
    expect(state.theme).toBe('dark');
  });

  it('navigate changes currentScreen', () => {
    useUIStore.getState().navigate('conversation');
    expect(useUIStore.getState().currentScreen).toBe('conversation');
  });

  it('navigate to settings', () => {
    useUIStore.getState().navigate('settings');
    expect(useUIStore.getState().currentScreen).toBe('settings');
  });

  it('toggleInfoPanel flips boolean', () => {
    expect(useUIStore.getState().showInfoPanel).toBe(false);
    useUIStore.getState().toggleInfoPanel();
    expect(useUIStore.getState().showInfoPanel).toBe(true);
    useUIStore.getState().toggleInfoPanel();
    expect(useUIStore.getState().showInfoPanel).toBe(false);
  });

  it('setTheme changes theme', () => {
    useUIStore.getState().setTheme('light');
    expect(useUIStore.getState().theme).toBe('light');
    useUIStore.getState().setTheme('system');
    expect(useUIStore.getState().theme).toBe('system');
  });
});
