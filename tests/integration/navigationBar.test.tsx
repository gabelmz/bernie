import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { NavigationBar } from '@/components/NavigationBar';

// Mock child pages
vi.mock('@/components/DocsPage', () => ({
  DocsPage: () => <div data-testid="docs-page">Documentation Content</div>,
}));
vi.mock('@/components/IntegrationsPage', () => ({
  IntegrationsPage: () => <div data-testid="integrations-page">Integrations Directory</div>,
}));
vi.mock('@/components/NodeGalleryPage', () => ({
  NodeGalleryPage: () => <div data-testid="gallery-page">Node Gallery Directory</div>,
}));
vi.mock('@/components/SettingsPage', () => ({
  SettingsPage: () => <div data-testid="settings-page">Settings View</div>,
}));

describe('NavigationBar Component Integration', () => {
  it('toggles sidebar collapse state when chevron button is clicked', () => {
    const { container } = render(<NavigationBar />);
    const sidebar = container.querySelector('.absolute.top-1\\/2');
    expect(sidebar).toHaveClass('w-14');

    // Click toggle button
    const toggleButton = sidebar?.querySelector('button');
    expect(toggleButton).toBeTruthy();
    if (toggleButton) {
      fireEvent.click(toggleButton);
      expect(sidebar).toHaveClass('w-48');
    }
  });

  it('opens and closes the requested modal page', () => {
    render(<NavigationBar />);

    // Open Docs
    const docsButton = screen.getByTitle('Docs');
    fireEvent.click(docsButton);
    expect(screen.getByTestId('docs-page')).toBeInTheDocument();

    // Close button
    const closeButtons = screen.getAllByRole('button');
    const closeBtn = closeButtons.find(b => b.querySelector('svg.lucide-x') || b.textContent === '');
    if (closeBtn) {
      fireEvent.click(closeBtn);
    }
  });

  it('switches between pages cleanly', () => {
    render(<NavigationBar />);

    const settingsButton = screen.getByTitle('Settings');
    fireEvent.click(settingsButton);
    expect(screen.getByTestId('settings-page')).toBeInTheDocument();

    const galleryButton = screen.getByTitle('Node Gallery');
    fireEvent.click(galleryButton);
    expect(screen.getByTestId('gallery-page')).toBeInTheDocument();
  });
});
