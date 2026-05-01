import React from 'react';
import { supabase } from '../../../supabase-auth/client';

/**
 * Implements the Logout tab for the settings dialog.
 *
 * @returns {React$Element}
 */
const LogoutTab = () => {
    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.reload();
    };

    return (
        <div className="logout-tab-container" style={{ 
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            textAlign: 'center'
        }}>
            <h2 style={{ marginBottom: '16px', color: '#ffffff' }}>Sign Out</h2>
            <p style={{ marginBottom: '24px', color: '#d1d5db' }}>Are you sure you want to sign out of your account?</p>
            <button 
                onClick={handleLogout}
                style={{
                    backgroundColor: '#c01140',
                    color: 'white',
                    border: 'none',
                    padding: '10px 24px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#a00f35')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#c01140')}
            >
                Confirm Logout
            </button>
        </div>
    );
};

export default LogoutTab;
