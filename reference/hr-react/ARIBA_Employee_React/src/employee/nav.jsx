import { createContext, useContext } from 'react';
const Ctx = createContext({ go: () => {}, openForgot: () => {}, openPw: () => {} });
export const NavProvider = Ctx.Provider;
export const useAppNav = () => useContext(Ctx);
