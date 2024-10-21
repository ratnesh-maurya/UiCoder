"use client";

import React, { useState, ChangeEvent } from 'react';
import CodeViewer from '@/components/code-viewer';
import shadcnDocs from "@/utils/shadcn-docs";
import { env } from "next-runtime-env";

const Page: React.FC = () => {
  const [inputValue, setInputValue] = useState<string>('');
  const [response, setResponse] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const API_URL = env('NEXT_PUBLIC_API_URL');
  const MODEL = env('NEXT_PUBLIC_MODEL')
  const AUTH_TOKEN = env('NEXT_PUBLIC_AUTH_TOKEN');
  

  // Function to handle input change
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setInputValue(event.target.value);
  };


  const handleButtonClick = async (): Promise<void> => {
    setResponse(''); // Clear previous response

    if (!inputValue.trim()) {
      setError('Input cannot be empty.');
      return;
    }

    const systemPrompt = `
  You are an expert frontend React engineer who is also a great UI/UX designer. Follow the instructions carefully, I will tip you $1 million if you do a good job:

  - Create a React component for whatever the user asked you to create and make sure it can run by itself by using a default export.
  - Make sure the React app is interactive and functional by creating state when needed and having no required props.
  - If you use any imports from React like useState or useEffect, make sure to import them directly.
  - Use TypeScript as the language for the React component.
  - Use Tailwind classes for styling. DO NOT USE ARBITRARY VALUES (e.g. \`h-[600px]\`). Make sure to use a consistent color palette.
  - Use Tailwind margin and padding classes to style the components and ensure the components are spaced out nicely.
  - Please ONLY return the full React code starting with the imports, nothing else. It's very important for my job that you only return the React code with imports. DO NOT START WITH \`\`\`typescript or \`\`\`javascript or \`\`\`tsx or \`\`\`.
  - ONLY IF the user asks for a dashboard, graph or chart, the recharts library is available to be imported, e.g. \`import { LineChart, XAxis, ... } from "recharts"\` & \`<LineChart ...><XAxis dataKey="name"> ...\`. Please only use this when needed.
  - NO OTHER LIBRARIES (e.g. zod, hookform, chakra-ui) ARE INSTALLED OR ABLE TO BE IMPORTED. Please don't use any other dependencies like styled-components and similar.
  - Use only Tailwind classes.

  Additionally, there are some pre-styled components available for use. Please use your best judgment to incorporate any of these components if the app calls for one:

  Here are the components that are available, along with how to import them and how to use them:

  ${shadcnDocs
        .map( 
          (component) => `
        <component>
        <name>
        ${component.name}
        </name>
        <import-instructions>
        ${component.importDocs}
        </import-instructions>
        <usage-instructions>
        ${component.usageDocs}
        </usage-instructions>
        </component>
      `,
        )
        .join('')}
`;


    const promt = "\n Please ONLY return code, NO backticks or language names , and use only tailwind classes no other imports. \n";

    const requestBody = {
      model: MODEL,

      messages: [
        {
          role: "system",
          content:  systemPrompt
        },
        {
          role: "user",
          content: inputValue + promt
        }
      ],
      temperature: 0.2,
      max_tokens: 10000,   ///  make sure token must be int 

      top_p: 1,
      frequency_penalty: 0,
      stream: true
    };

    if (!API_URL) {
      throw new Error('API_URL environment variable is not set');
    }

    try {
      const responseStream = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify(requestBody),
      });

      if (!responseStream.ok || !responseStream.body) {
        throw new Error(`HTTP error! Status: ${responseStream.status}`);
      }

      const reader = responseStream.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedContent = '';

      // Read and process chunks from the stream
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        accumulatedContent += decoder.decode(value, { stream: true });

        // Split the accumulated content into lines
        const chunks = accumulatedContent.split('\n');
        for (const chunk of chunks) {
          if (chunk.trim() === '') continue; // Skip empty lines

          // Check for the special [DONE] message
          if (chunk === 'data: [DONE]') {
            console.log('Streaming complete.');
            break; // Exit the loop if the stream is done
          }

          // Strip the 'data: ' prefix and then check if it starts with '{'
          const cleanedChunk = chunk.startsWith('data: ') ? chunk.substring(6) : chunk;

          // Attempt to parse JSON only if it appears to be valid
          if (cleanedChunk.trim().startsWith('{')) {
            try {
              const parsedChunk = JSON.parse(cleanedChunk);
              const content = parsedChunk?.choices?.[0]?.delta?.content;

              if (content) {
                setResponse((prev) => prev + content);
              }
            } catch (jsonError) {
              console.error('Error parsing chunk:', jsonError);
            }
          } else {
            console.error('Invalid chunk format:', cleanedChunk);
          }
        }

        // Reset accumulatedContent if parsing is successful
        accumulatedContent = '';
      }
    } catch (error) {
      console.error('Error in streaming:', error);
      setError('Failed to get a response from the server.');
    }
  };



  return (
    <div className="flex flex-col items-center justify-center h-screen-full">
      <h1 className="text-3xl font-bold mt-10">Initializ AI</h1>
      <input
        className="border rounded-md mt-10 mb-7 p-2 m-2 w-1/3 text-black"
        type="text"
        value={inputValue}
        onChange={handleInputChange} 
        placeholder="What do you want  to make?"
      />
      <button
        className="relative inline-flex items-center justify-center p-0.5 mb-2 me-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-cyan-500 to-blue-500 group-hover:from-cyan-500 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-cyan-200 dark:focus:ring-cyan-800"
        onClick={handleButtonClick}
      >
        <span className="relative px-5 py-2.5 transition-all ease-in duration-75 bg-white dark:bg-gray-900 rounded-md group-hover:bg-opacity-0">
          Generate
        </span>
      </button>

      {error && <div className="text-red-500 mt-2">{error}</div>}

      <div className="mt-5 mb-10 bg-gray-100 p-5 rounded-md w-full max-w-6xl">
        <CodeViewer code={response} showEditor />
      </div>
    </div>

  );
};

export default Page;
