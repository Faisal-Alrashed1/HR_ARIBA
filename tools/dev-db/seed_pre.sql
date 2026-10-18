-- Synthetic rows the normalization needs before it runs (it requires the configured approvers 40 = HR and 86 = CEO).
-- No real data. Passwords are set afterwards by seed.py from ARIBA_DEV_PASSWORD.
INSERT INTO company_settings(id) VALUES ('default') ON CONFLICT DO NOTHING;
INSERT INTO employee_directory(employee_id, username, name_ar, name_en, employer, department, job_title, nationality, dob, join_date, active, data) VALUES
 ('40', 'hr.test', 'هند الاختبار', 'Hind Test', 'أريبا', 'الموارد البشرية', 'أخصائي موارد بشرية', 'سعودي', '1990-03-14', '2019-02-01', true,
  '{"empNo":"40","nameAr":"هند الاختبار","isSaudi":true,"gender":"أنثى","salary":12000,"housingAllowance":3000,"transportAllowance":1200,"insSystem":"new","wpsType":"wps","contractJoin":"2019-02-01","contractNature":"indefinite","leaveDaysContract":21,"email":"hr.test@example.com"}'),
 ('86', 'ceo.test', 'خالد الاختبار', 'Khalid Test', 'أريبا', 'الإدارة', 'الرئيس التنفيذي', 'سعودي', '1978-07-02', '2015-01-04', true,
  '{"empNo":"86","nameAr":"خالد الاختبار","isSaudi":true,"gender":"ذكر","salary":40000,"housingAllowance":10000,"transportAllowance":4000,"insSystem":"old","wpsType":"wps","contractJoin":"2015-01-04","contractNature":"indefinite","leaveDaysContract":30,"email":"ceo.test@example.com"}')
ON CONFLICT DO NOTHING;
INSERT INTO ariba_auth_accounts(username, password_hash, role, employee_id, active) VALUES
 ('hr.test', '!', 'hr', '40', true), ('ceo.test', '!', 'ceo', '86', true)
ON CONFLICT DO NOTHING;
