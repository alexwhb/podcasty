import {FontBoldIcon, FontItalicIcon, UnderlineIcon, Link1Icon} from '@radix-ui/react-icons';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import * as Tooltip from '@radix-ui/react-tooltip';
import React, {type ReactNode, useCallback, useMemo, useState, useEffect} from 'react';
import {type JSX} from 'react/jsx-runtime';
import { createEditor, Editor, Transforms, type Descendant, Element as SlateElement, type BaseEditor} from 'slate';
import {Editable, withReact, useSlate, Slate, type RenderLeafProps, type RenderElementProps} from 'slate-react';


type Element = {
  type: string
  url?: string
  children: Descendant[]
}


declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor
    Element: Element
    Text: {
      text: string
      bold?: boolean
      italic?: boolean
      underline?: boolean
    }
  }
}

const sanitizeSlateData = (nodes: Descendant[]): Descendant[] => {
  return nodes
    .map((node) => {
      if (SlateElement.isElement(node)) {
        // Filter out nodes with no children or empty children arrays
        if (!node.children || node.children.length === 0) {
          return null; // Mark this node for removal
        }

        // Recursively sanitize children
        node.children = sanitizeSlateData(node.children);

        // If the node still has no valid children after sanitization, remove it
        if (node.children.length === 0) {
          return null;
        }
      }

      return node;
    })
    .filter(Boolean) as Descendant[]; // Remove null nodes
};

// Function to deserialize HTML into Slate-compatible format
const deserialize = (html: string): Descendant[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const deserializeNode = (node: ChildNode): Descendant | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return { text: node.textContent || '' };
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const element = node as HTMLElement;

    switch (element.tagName.toLowerCase()) {
      case 'p':
        return {
          type: 'paragraph',
          children: Array.from(element.childNodes).map(deserializeNode).filter(Boolean) as Descendant[],
        };
      case 'strong':
        return {
          text: element.textContent || '',
          bold: true,
        };
      case 'em':
        return {
          text: element.textContent || '',
          italic: true,
        };
      case 'u':
        return {
          text: element.textContent || '',
          underline: true,
        };
      case 'a': // Handle <a> tags
        return {
          type: 'link',
          url: element.getAttribute('href') || '',
          children: Array.from(element.childNodes)
            .map(deserializeNode)
            .filter(Boolean) as Descendant[],
        };
      case 'ul':
        return {
          type: 'bulleted-list',
          children: Array.from(element.childNodes).map(deserializeNode).filter(Boolean) as Descendant[],
        };
      case 'li':
        return {
          type: 'list-item',
          children: Array.from(element.childNodes).map(deserializeNode).filter(Boolean) as Descendant[],
        };
      default:
        return {
          type: 'paragraph',
          children: Array.from(element.childNodes).map(deserializeNode).filter(Boolean) as Descendant[],
        };
    }
  };

  const body = doc.body;
  return Array.from(body.childNodes).map(deserializeNode).filter(Boolean) as Descendant[];
};


/**
 * This converts our output back into HTML so we can save it to our db.
 */
const serialize = (nodes: Descendant[]): string => {
  return nodes
    .map((node) => {
      if (SlateElement.isElement(node)) {
        switch (node.type) {
          case 'paragraph':
            return `<p>${serialize(node.children)}</p>`;
          case 'bulleted-list':
            return `<ul>${serialize(node.children)}</ul>`;
          case 'list-item':
            return `<li>${serialize(node.children)}</li>`;
          case 'link':
            return `<a href="${node.url}" target="_blank" rel="noopener noreferrer">${serialize(
              node.children
            )}</a>`;
          default:
            return `<p>${serialize(node.children)}</p>`;
        }
      }

      // Handle text nodes with formatting (bold, italic, underline)
      if (node.text) {
        let text = node.text;
        if (node.bold) {
          text = `<strong>${text}</strong>`;
        }
        if (node.italic) {
          text = `<em>${text}</em>`;
        }
        if (node.underline) {
          text = `<u>${text}</u>`;
        }
        return text;
      }

      return '';
    })
    .join('');
};


const RichTextEditor = ({ initialHTML, onChange }: { initialHTML?: string, onChange: () => Element }) => {
  const initialValue = useMemo(() => {
    try {
      const parsed = deserialize(initialHTML!);
      return sanitizeSlateData(parsed);
    } catch (error) {
      console.error('Error parsing initial HTML:', error);
      return [{ type: 'paragraph', children: [{ text: '' }] }];
    }
  }, [initialHTML]);

  const [value, setValue] = useState<Descendant[]>(initialValue);
  const editor = useMemo(() => withReact(createEditor()), []);

  useEffect(() => {
    console.log(serialize( value))
  }, [value]);


  const renderElement = useCallback((props: JSX.IntrinsicAttributes & {
    attributes: any;
    children: any;
    element: any;
  }) => <Element {...props} />, []);
  const renderLeaf = useCallback((props: JSX.IntrinsicAttributes & { attributes: any; children: any; leaf: any; }) =>
    <Leaf {...props} />, []);

  return (
    <Slate editor={editor} initialValue={value} onChange={setValue}>
      <ToggleGroup.Root
        type="multiple"
        className="flex gap-2 p-2 bg-white rounded-lg shadow-sm mb-2"
      >
        <TooltipComponent content="Bold">
          <MarkToggle format="bold">
            <FontBoldIcon/>
          </MarkToggle>
        </TooltipComponent>

        <TooltipComponent content="Italic">
          <MarkToggle format="italic">
            <FontItalicIcon/>
          </MarkToggle>
        </TooltipComponent>

        <TooltipComponent content="Underline">
          <MarkToggle format="underline">
            <UnderlineIcon />
          </MarkToggle>
        </TooltipComponent>

        <TooltipComponent content="link" >
          <MarkToggle format="link">
            <Link1Icon />
          </MarkToggle>
        </TooltipComponent>
      </ToggleGroup.Root>

      <Editable
        className="min-h-[200px] p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        renderElement={renderElement}
        renderLeaf={renderLeaf}
        placeholder="Input description here..."
        spellCheck
      />
    </Slate>
  );
};

// Tooltip component
const TooltipComponent = ({ children, content }: { children: React.ReactNode; content: string }) => (
  <Tooltip.Provider>
    <Tooltip.Root>
      <Tooltip.Trigger>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="px-2 py-1 text-sm bg-gray-800 text-white rounded" sideOffset={5}>
          {content}
          <Tooltip.Arrow className="fill-gray-800" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
);


interface MarkToggleProps {
  format: string;
  children: ReactNode;
}

// Radix-powered Toggle components
const MarkToggle: React.FC<MarkToggleProps> = ({ format, children }) => {
  const editor = useSlate();
  const active = isMarkActive(editor, format);

  return (
    <ToggleGroup.Item
      value={format}
      className={`p-2 rounded hover:bg-gray-100 ${active ? 'bg-gray-100' : ''}`}
      onMouseDown={e => {
        e.preventDefault();
        toggleMark(editor, format);
      }}
    >
      {children}
    </ToggleGroup.Item>
  );
};


const toggleMark = (editor: BaseEditor, format: string) => {
  const isActive = isMarkActive(editor, format)
  console.log(isActive, format)

  if (isActive) {
    Editor.removeMark(editor, format)
  } else {
    Editor.addMark(editor, format, true)
  }
}
const isMarkActive = (editor: BaseEditor, format: keyof CustomText): boolean => {
  const marks = Editor.marks(editor) as CustomText | null;
  return marks ? marks[format] === true : false;
};

// Element and Leaf components remain mostly the same
const Element: React.FC<RenderElementProps> = ({ attributes, children, element }) => {
  switch (element.type) {
    case 'bulleted-list':
      return <ul  {...attributes}>{children}</ul>;
    case 'list-item':
      return <li {...attributes}>{children}</li>;
    case 'link': // Render <a> tags for links
      return (
        <a
          {...attributes}
          href={element.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'blue', textDecoration: 'underline' }}
        >
          {children}
        </a>
      );
    default:
      return <p  {...attributes}>{children}</p>;
  }
};


const Leaf: React.FC<RenderLeafProps> = ({ attributes, children, leaf }) => {
  if (leaf.bold) children = <b>{children}</b>;
  if (leaf.italic) children = <i>{children}</i>;
  if (leaf.underline) children = <u>{children}</u>;
  return <span {...attributes}>{children}</span>;
};
export default RichTextEditor;