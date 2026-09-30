import { HomeIcon, ListIcon } from "@salt-ds/icons";
import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { ThemeToggle } from "@shared/ui";
import styles from "./AppShell.module.css";

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">Skip to content</a>
      <header className={styles.header}>
        <div className={styles.brand} aria-label="{{DISPLAY_NAME}}">{{DISPLAY_NAME}}</div>
        <ThemeToggle />
      </header>
      <nav className={styles.navigation} aria-label="Primary navigation">
        <NavLink className={({ isActive }) => `${styles.navigationItem} ${isActive ? styles.active : ""}`} to="/" end>
          <HomeIcon aria-hidden="true" />
          <span>Home</span>
        </NavLink>
        <NavLink className={({ isActive }) => `${styles.navigationItem} ${isActive ? styles.active : ""}`} to="/work-items">
          <ListIcon aria-hidden="true" />
          <span>Work items</span>
        </NavLink>
      </nav>
      <main className={styles.content} id="main-content" tabIndex={-1}>
        <div className={styles.contentInner}>{children}</div>
      </main>
    </div>
  );
}