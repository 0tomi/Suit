import { useCallback, useReducer } from 'react';
import { formDataEmpty } from './agendaControllerUtils.js';

const modalInitial = {
    modalOpen: false,
    selectedEvent: null,
    formData: formDataEmpty,
    error: '',
    saving: false,
};

function modalReducer(state, action) {
    switch (action.type) {
        case 'OPEN_NEW':
            return { ...state, modalOpen: true, selectedEvent: null, formData: action.payload, error: '' };
        case 'OPEN_EDIT':
            return { ...state, modalOpen: true, selectedEvent: action.payload.event, formData: action.payload.formData, error: '' };
        case 'CLOSE':
            return { ...modalInitial };
        case 'SET_FORM':
            return { ...state, formData: action.payload };
        case 'PATCH_FORM':
            return { ...state, formData: { ...state.formData, ...action.payload } };
        case 'SET_ERROR':
            return { ...state, error: action.payload, saving: false };
        case 'SET_SAVING':
            return { ...state, saving: action.payload };
        case 'CLEAR_ERROR':
            return { ...state, error: '' };
        default:
            return state;
    }
}

export function useAgendaModalState() {
    const [modal, dispatchModal] = useReducer(modalReducer, modalInitial);

    const updateFormData = useCallback((formData) => {
        dispatchModal({ type: 'SET_FORM', payload: formData });
    }, []);

    const clearModalError = useCallback(() => {
        dispatchModal({ type: 'CLEAR_ERROR' });
    }, []);

    return {
        modal,
        dispatchModal,
        updateFormData,
        clearModalError,
    };
}
