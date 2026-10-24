import React from 'react';
import { text } from '../../i18n';
import { APP_NAME } from '../../config/branding';
import AppBrandMark from './AppBrandMark';

type ShellBrandProps = {
  compact?: boolean;
  className?: string;
};

const ShellBrand: React.FC<ShellBrandProps> = ({ compact = false, className = '' }) => {
  if (compact) {
    return (
      <div className={`tt-brand-logo-wrap tt-brand-logo-wrap--compact ${className}`.trim()}>
        <AppBrandMark compact title={APP_NAME} />
        <span className="sr-only">{APP_NAME}</span>
      </div>
    );
  }
  return (
    <div className={`tt-brand-block ${className}`.trim()}>
      <AppBrandMark title={APP_NAME} />
      <p className="tt-brand-eyebrow">{APP_NAME}</p>
      <p className="tt-brand-wordmark">{text('Área de trabalho', 'Workspace')}</p>
    </div>
  );
};

export default ShellBrand;
