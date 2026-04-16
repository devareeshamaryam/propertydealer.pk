'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const NotFound = () => {
  const pathname = usePathname();

  useEffect(() => {
    console.log(`404: Tried to access ${pathname}`);
    // or send to analytics, etc.
  }, [pathname]);

  return (
    <div>
      <h1>404 - Page Not Found</h1>
      <p>Sorry, we couldn't find: {pathname}</p>
    </div>
  );
};

export default NotFound;