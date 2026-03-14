import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

// Mock the global fetch API to test successful state updates safely
global.fetch = vi.fn();

describe('App Component', () => {
  it('renders the header correctly', () => {
    render(<App />);
    expect(screen.getByText('Agricultural Data Platform')).toBeInTheDocument();
  });

  it('updates message state to backend running when test button clicked', async () => {
    // Setup the mock response to simulate a healthy backend reply
    fetch.mockResolvedValueOnce({
      json: async () => ({ status: 'backend running' }),
    });

    render(<App />);
    
    // Simulate user interaction
    const testButton = screen.getByText('Test Backend');
    fireEvent.click(testButton);

    // Assert that the mocked endpoint was called
    expect(fetch).toHaveBeenCalledWith('/api/health');

    // Assert that the React state correctly displays the mock response on the screen
    const statusText = await screen.findByText('backend running');
    expect(statusText).toBeInTheDocument();
  });
});
