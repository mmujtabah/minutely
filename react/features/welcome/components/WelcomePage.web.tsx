import React from 'react';
import { connect } from 'react-redux';
import { translate } from '../../base/i18n/functions';
import DashboardPage from '../../dashboard/components/DashboardPage.web';

// Keep the old AbstractWelcomePage props if needed by router
const WelcomePage = () => {
    // We replace the old Jitsi welcome page with our new Minutely Dashboard
    return <DashboardPage />;
};

export default translate(connect()(WelcomePage));
