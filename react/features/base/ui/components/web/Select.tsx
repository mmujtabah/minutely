import React, { useCallback, useState, useRef, useEffect } from 'react';
import { makeStyles } from 'tss-react/mui';
import { isMobileBrowser } from '../../../environment/utils';
import Icon from '../../../icons/components/Icon';
import { IconArrowDown, IconCheck } from '../../../icons/svg';
import ContextMenu from './ContextMenu';
import ContextMenuItem from './ContextMenuItem';

interface ISelectProps {
    bottomLabel?: string;
    className?: string;
    containerClassName?: string;
    disabled?: boolean;
    error?: boolean;
    id: string;
    label?: string;
    onChange: (e: any) => void;
    options: Array<{
        label: string;
        value: number | string;
    }>;
    value: number | string;
}

const useStyles = makeStyles()(theme => {
    return {
        container: {
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
        },

        label: {
            color: theme.palette.selectLabel,
            ...theme.typography.bodyShortRegular,
            marginBottom: theme.spacing(2),

            '&.is-mobile': {
                ...theme.typography.bodyShortRegularLarge
            }
        },

        trigger: {
            backgroundColor: theme.palette.selectBackground,
            borderRadius: `${theme.shape.borderRadius}px`,
            width: '100%',
            ...theme.typography.bodyShortRegular,
            color: theme.palette.selectText,
            padding: '10px 16px',
            paddingRight: '42px',
            border: `1px solid ${theme.palette.ui03 || 'rgba(255,255,255,0.1)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            minHeight: '40px',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s, box-shadow 0.2s',

            '&:hover': {
                borderColor: theme.palette.action01
            },

            '&.open': {
                borderColor: theme.palette.action01,
                boxShadow: `0px 0px 0px 2px ${theme.palette.selectFocus}`
            },

            '&.disabled': {
                color: theme.palette.selectDisabled,
                cursor: 'not-allowed',
                opacity: 0.6
            },

            '&.error': {
                borderColor: theme.palette.selectError,
                boxShadow: `0px 0px 0px 2px ${theme.palette.selectError}`
            }
        },

        valueText: {
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis'
        },

        icon: {
            transition: 'transform 0.2s',
            '&.open': {
                transform: 'rotate(180deg)'
            }
        },

        menu: {
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '100%',
            backgroundColor: theme.palette.overflowMenuBackground,
            border: `1px solid ${theme.palette.overflowMenuBorder}`,
            borderRadius: `${theme.shape.borderRadius}px`,
            boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            maxHeight: '240px',
            overflowY: 'auto',
            padding: '4px 0'
        },

        bottomLabel: {
            marginTop: theme.spacing(2),
            ...theme.typography.labelRegular,
            color: theme.palette.selectBottomLabel,

            '&.is-mobile': {
                ...theme.typography.bodyShortRegular
            },

            '&.error': {
                color: theme.palette.selectBottomLabelError
            }
        }
    };
});

const Select = ({
    bottomLabel,
    containerClassName,
    className,
    disabled,
    error,
    id,
    label,
    onChange,
    options,
    value }: ISelectProps) => {
    const { classes, cx, theme } = useStyles();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const isMobile = isMobileBrowser();

    const selectedOption = options.find(opt => opt.value === value) || options[0];

    const toggleMenu = useCallback(() => {
        if (!disabled) {
            setIsOpen(!isOpen);
        }
    }, [isOpen, disabled]);

    const onOptionClick = useCallback((optionValue: string | number) => {
        setIsOpen(false);
        // Mock a native change event for compatibility
        onChange({
            target: {
                value: optionValue,
                id
            }
        });
    }, [onChange, id]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className = { cx(classes.container, containerClassName) } ref = { containerRef }>
            {label && <label className = { cx(classes.label, isMobile && 'is-mobile') } htmlFor = { id } >
                {label}
            </label>}
            
            <div 
                className = { cx(classes.trigger, isOpen && 'open', disabled && 'disabled', error && 'error', className) }
                id = { id }
                onClick = { toggleMenu }
                role = "button"
                aria-haspopup = "listbox"
                aria-expanded = { isOpen }>
                <span className = { classes.valueText }>
                    {selectedOption?.label || ''}
                </span>
                <Icon
                    className = { cx(classes.icon, isOpen && 'open') }
                    color = { disabled ? theme.palette.selectIconDisabled : theme.palette.selectIcon }
                    size = { 18 }
                    src = { IconArrowDown } />
            </div>

            {isOpen && (
                <div className = { classes.menu } role = "listbox">
                    {options.map(option => (
                        <ContextMenuItem
                            accessibilityLabel = { option.label }
                            key = { option.value }
                            onClick = { () => onOptionClick(option.value) }
                            selected = { option.value === value }
                            text = { option.label } />
                    ))}
                </div>
            )}

            {bottomLabel && (
                <span
                    className = { cx(classes.bottomLabel, isMobile && 'is-mobile', error && 'error') }
                    id = { `${id}-description` }>
                    {bottomLabel}
                </span>
            )}
        </div>
    );
};

export default Select;
