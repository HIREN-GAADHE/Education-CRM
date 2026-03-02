import { apiSlice } from './apiSlice';

export interface HealthRecord {
    id: string;
    student_id: string;
    blood_group?: string;
    height_cm?: number;
    weight_kg?: number;
    vision_left?: string;
    vision_right?: string;
    allergies?: string;
    chronic_conditions?: string;
    current_medications?: string;
    dietary_restrictions?: string;
    special_needs?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relation?: string;
    family_doctor_name?: string;
    family_doctor_phone?: string;
    health_insurance_number?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface NurseVisit {
    id: string;
    student_id: string;
    visit_date: string;
    symptoms?: string;
    diagnosis?: string;
    treatment_given?: string;
    medication_given?: string;
    sent_home: boolean;
    parent_notified: boolean;
    follow_up_required: boolean;
    follow_up_date?: string;
    notes?: string;
    created_at: string;
}

export interface Vaccination {
    id: string;
    student_id: string;
    vaccine_name: string;
    dose_number: number;
    administered_date?: string;
    administered_by?: string;
    next_due_date?: string;
    status: 'completed' | 'pending' | 'scheduled' | 'exempted';
    batch_number?: string;
    notes?: string;
    created_at: string;
}

const healthApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getHealthRecord: builder.query<HealthRecord, string>({
            query: (studentId) => `/health-records/students/${studentId}`,
            providesTags: ['HealthRecords'],
        }),
        upsertHealthRecord: builder.mutation<HealthRecord, { studentId: string; data: Partial<HealthRecord> }>({
            query: ({ studentId, data }) => ({ url: `/health-records/students/${studentId}`, method: 'PUT', body: data }),
            invalidatesTags: ['HealthRecords'],
        }),
        getNurseVisits: builder.query<NurseVisit[], string>({
            query: (studentId) => `/health-records/students/${studentId}/visits`,
            providesTags: ['HealthRecords'],
        }),
        logNurseVisit: builder.mutation<NurseVisit, { studentId: string; data: Partial<NurseVisit> }>({
            query: ({ studentId, data }) => ({ url: `/health-records/students/${studentId}/visits`, method: 'POST', body: data }),
            invalidatesTags: ['HealthRecords'],
        }),
        deleteNurseVisit: builder.mutation<void, string>({
            query: (id) => ({ url: `/health-records/visits/${id}`, method: 'DELETE' }),
            invalidatesTags: ['HealthRecords'],
        }),
        getVaccinations: builder.query<Vaccination[], string>({
            query: (studentId) => `/health-records/students/${studentId}/vaccinations`,
            providesTags: ['HealthRecords'],
        }),
        addVaccination: builder.mutation<Vaccination, { studentId: string; data: Partial<Vaccination> }>({
            query: ({ studentId, data }) => ({ url: `/health-records/students/${studentId}/vaccinations`, method: 'POST', body: data }),
            invalidatesTags: ['HealthRecords'],
        }),
        deleteVaccination: builder.mutation<void, string>({
            query: (id) => ({ url: `/health-records/vaccinations/${id}`, method: 'DELETE' }),
            invalidatesTags: ['HealthRecords'],
        }),
    }),
});

export const {
    useGetHealthRecordQuery,
    useUpsertHealthRecordMutation,
    useGetNurseVisitsQuery,
    useLogNurseVisitMutation,
    useDeleteNurseVisitMutation,
    useGetVaccinationsQuery,
    useAddVaccinationMutation,
    useDeleteVaccinationMutation,
} = healthApi;
