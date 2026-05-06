export const fr = {
  // ── Common ──
  'common.save':      'Enregistrer',
  'common.cancel':    'Annuler',
  'common.confirm':   'Confirmer',
  'common.delete':    'Supprimer',
  'common.edit':      'Modifier',
  'common.add':       'Ajouter',
  'common.close':     'Fermer',
  'common.search':    'Rechercher…',
  'common.loading':   'Chargement…',
  'common.required':  '(requis)',
  'common.optional':  '(facultatif)',
  'common.yes':       'Oui',
  'common.no':        'Non',
  'common.signout':   'Déconnexion',
  'common.try_again': 'Réessayer',
  'common.from':      'Du',
  'common.to':        'Au',
  'common.date':      'Date',
  'common.name':      'Nom',
  'common.type':      'Type',
  'common.status':    'Statut',
  'common.actions':   'Actions',
  'common.reason':    'Motif',
  'common.month':     'Mois',

  // ── Login screen ──
  'login.title':     'Système de Paie',
  'login.subtitle':  'Liban — Connectez-vous pour accéder aux données de paie',
  'login.google':    'Se connecter avec Google',
  'login.microsoft': 'Se connecter avec Microsoft',
  'login.or':        'ou',
  'login.error':     'Échec de la connexion. Veuillez réessayer.',

  // ── Sidebar nav ──
  'nav.main':           'Principal',
  'nav.dashboard':      'Tableau de bord',
  'nav.employees':      'Employés',
  'nav.payroll':        'Rapport de paie',
  'nav.reports':        'Rapports',
  'nav.attendance':     'Demandes de présence',
  'nav.config':         'Configuration',
  'nav.settings':       'Paramètres',
  'nav.admin':          'Admin',
  'nav.switch_company': 'Changer d\'établissement',
  'nav.signout_short':  'Quitter',

  // ── Mobile bottom nav ──
  'nav_m.dashboard': 'Accueil',
  'nav_m.employees': 'Employés',
  'nav_m.payroll':   'Paie',
  'nav_m.reports':   'Rapports',
  'nav_m.settings':  'Réglages',

  // ── Settings page ──
  'settings.title':       'Paramètres',
  'settings.subtitle':    'Configurez les taux, formules et taux de change',
  'settings.language':    'Langue',
  'settings.lang_hint':   'Changer la langue rechargera la page.',

  // ── Employee Portal ──
  'portal.title':              'Portail Employé',
  'portal.payslip_title':      'Mon bulletin de paie',
  'portal.history_title':      'Historique des présences',
  'portal.greeting':           'Bonjour, {name} 👋',
  'portal.role.teacher':       'Enseignant',
  'portal.role.administrator': 'Administrateur',

  // Drawer
  'portal.drawer.home':    'Accueil',
  'portal.drawer.payslip': 'Mon bulletin',
  'portal.drawer.history': 'Historique',

  // Absence form
  'portal.absence.title':       '🚫 Demande d\'absence',
  'portal.absence.subtitle':    'Un jour où vous ne viendrez pas travailler — compte comme -1 jour sur votre bulletin.',
  'portal.absence.date':        'Date',
  'portal.absence.date_hint':   'Du {earliest} à toute date future.',
  'portal.absence.category':    'Catégorie',
  'portal.absence.reason':      'Motif / Note',
  'portal.absence.placeholder': 'Facultatif — ex : rendez-vous médical',
  'portal.absence.submit':      '✓ Envoyer la demande d\'absence',

  // Permanence form
  'portal.permanence.title':       '🎯 Demande de permanence',
  'portal.permanence.subtitle':    'Un jour où vous êtes venu travailler alors qu\'il était férié (vacances, week-end, congé) — compte comme +1 jour sur votre bulletin.',
  'portal.permanence.date':        'Date travaillée',
  'portal.permanence.reason':      'Motif du travail',
  'portal.permanence.placeholder': 'ex : clôture de fin d\'année, surveillance d\'examen, tâche urgente…',
  'portal.permanence.submit':      '✓ Envoyer la demande de permanence',

  // Categories
  'category.sick':     'Congé maladie',
  'category.personal': 'Personnel',
  'category.training': 'Formation / Professionnel',
  'category.other':    'Autre',

  // Status
  'status.pending':  'En attente',
  'status.approved': 'Approuvée',
  'status.rejected': 'Refusée',

  // Type labels
  'type.absence':    'Absence',
  'type.permanence': 'Permanence',

  // Recent requests / history
  'portal.recent.title':     '📋 Demandes récentes',
  'portal.recent.view_all':  'Voir tout →',
  'portal.empty.title':      'Aucune demande pour le moment.',
  'portal.empty.sub':        'Vos demandes envoyées apparaîtront ici.',
  'portal.cancel':           'Annuler',
  'portal.cancel_confirm':   'Annuler cette demande en attente ?',
  'portal.cancel_failed':    'Annulation impossible. Réessayez.',
  'portal.admin_note':       'Note de l\'administrateur :',

  // History filters
  'portal.history.total':         'Total',
  'portal.history.filter_status': 'Filtrer par statut',
  'portal.history.filter_cat':    'Filtrer par catégorie',
  'portal.history.all':           'Toutes',
  'portal.history.empty':         'Aucune demande ne correspond.',

  // Pay slip
  'portal.payslip.month':              'Mois',
  'portal.payslip.base_salary':        'Salaire de base',
  'portal.payslip.working_days':       'Jours travaillés ce mois-ci',
  'portal.payslip.transport_per_day':  'Transport / jour',
  'portal.payslip.total_transport':    'Transport total (× {days} jours)',
  'portal.payslip.tax':                'Impôt',
  'portal.payslip.nfs':                'CNSS',
  'portal.payslip.net':                'Salaire net',
  'portal.payslip.download_pdf':       '⬇ Télécharger PDF',
  'portal.payslip.disclaimer':         'Calculé à partir des paramètres actuels. Pour les documents officiels, contactez votre administrateur.',
  'portal.payslip.from_calendar':      '{n} du calendrier',
  'portal.payslip.after_holidays':     'après {n} jour(s) férié(s)',
  'portal.payslip.minus_absences':     '− {n} absence(s)',
  'portal.payslip.plus_permanence':    '+ {n} jour(s) de permanence',
  'portal.payslip.no_events':          'Aucun jour férié, absence ou permanence ce mois-ci.',

  // Errors
  'portal.error.no_employee':    'Nous n\'avons pas trouvé votre fiche employé. Veuillez contacter votre administrateur.',
  'portal.error.submit_failed':  '⚠ Échec de l\'envoi. Réessayez.',

  // Misc
  'portal.access_issue': 'Problème d\'accès'
};
