import { Image } from '@nextui-org/react';
import { BookOpenText } from 'lucide-react';
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="text-gray-800 bg-white shadow-md">
      <div className="container flex justify-between items-center p-4 mx-auto">
        <div className="flex items-center">
          <Image
            src="https://2someone-web-static.s3.bitiful.net/2024/06/5f2b5bfcae6e587ab4e8bc42e4e5bc96.avif"
            alt="logo"
            className="mr-3 w-12 h-12 rounded-full"
          />
          <a
            href="https://2some.ren"
            target="_blank"
            className="transition-colors duration-300 hover:text-blue-600">
            <h1 className="text-2xl font-bold">{chrome.i18n.getMessage('optionsTitle')}</h1>
          </a>
        </div>
        <nav>
          <ul className="flex space-x-4">
            <li>
              <a
                href="https://2some.ren/dashboard"
                target="_blank"
                className="flex items-center px-4 py-2 text-blue-600 bg-blue-100 rounded-full transition-all duration-300 hover:bg-blue-200">
                <BookOpenText className="mr-2" />
                <p className="text-lg">{chrome.i18n.getMessage('optionsViewDocs')}</p>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
