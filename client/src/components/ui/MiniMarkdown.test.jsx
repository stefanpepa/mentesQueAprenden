import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MiniMarkdown from './MiniMarkdown';

describe('MiniMarkdown', () => {
  it('no renderiza nada si no hay texto', () => {
    const { container } = render(<MiniMarkdown text="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza negrita con **texto**', () => {
    render(<MiniMarkdown text="hola **mundo**" />);
    const strong = screen.getByText('mundo');
    expect(strong.tagName).toBe('STRONG');
  });

  it('renderiza una lista cuando todas las líneas empiezan con "- "', () => {
    render(<MiniMarkdown text={'- primero\n- segundo'} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('primero');
    expect(items[1]).toHaveTextContent('segundo');
  });

  it('separa párrafos por líneas en blanco', () => {
    const { container } = render(<MiniMarkdown text={'primer párrafo\n\nsegundo párrafo'} />);
    const parrafos = container.querySelectorAll('p');
    expect(parrafos).toHaveLength(2);
  });
});
